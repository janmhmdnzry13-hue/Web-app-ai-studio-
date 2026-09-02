import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import {
  isDatabaseError,
  sanitizeLogContent,
  handleDatabaseError,
  centralErrorHandler,
  asyncHandler,
} from '../db/error-handler';
import { apiRouter } from '../routes';
import { setRepositoriesForTesting, resetRepositories } from '../repositories';
import { generateToken } from '../auth';

describe('Safe Server-Side Database Error Handling', () => {
  describe('isDatabaseError classification', () => {
    it('correctly identifies PostgreSQL error codes', () => {
      expect(isDatabaseError({ code: '28P01', message: 'password authentication failed' })).toBe(true);
      expect(isDatabaseError({ code: '08006', message: 'connection failure' })).toBe(true);
      expect(isDatabaseError({ code: '3D000', message: 'database "origin" does not exist' })).toBe(true);
      expect(isDatabaseError({ code: '42P01', message: 'relation "users" does not exist' })).toBe(true);
      expect(isDatabaseError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(true);
      expect(isDatabaseError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5432' })).toBe(true);
      expect(isDatabaseError({ code: 'ETIMEDOUT', message: 'connection timed out' })).toBe(true);
    });

    it('identifies database error names and message strings', () => {
      expect(isDatabaseError(new Error('CRITICAL_DATABASE_ERROR: Pool is unavailable'))).toBe(true);
      expect(isDatabaseError({ name: 'DatabaseError', message: 'syntax error at or near SELECT' })).toBe(true);
      expect(isDatabaseError({ name: 'PostgresError', message: 'terminating connection due to administrator command' })).toBe(true);
      expect(isDatabaseError(new Error('PostgreSQL connection error'))).toBe(true);
    });

    it('returns false for non-database validation or business errors', () => {
      expect(isDatabaseError(new Error('INVALID_EMAIL'))).toBe(false);
      expect(isDatabaseError(new Error('User not found'))).toBe(false);
      expect(isDatabaseError({ code: 'AUTH_FAILED', message: 'Invalid credentials' })).toBe(false);
      expect(isDatabaseError(null)).toBe(false);
      expect(isDatabaseError(undefined)).toBe(false);
    });
  });

  describe('sanitizeLogContent credential stripping', () => {
    it('masks passwords and secrets in connection strings', () => {
      const rawConn = 'Error connecting to postgresql://origin_user:SuperSecretP@ss123@postgres-host.internal:5432/origin_db';
      const sanitized = sanitizeLogContent(rawConn);

      expect(sanitized).not.toContain('SuperSecretP@ss123');
      expect(sanitized).toContain('postgresql://***:***@');
    });

    it('masks standalone password query parameters and key values', () => {
      const log = 'DB error: password=MySecretPassword123; host=10.0.0.1';
      const sanitized = sanitizeLogContent(log);

      expect(sanitized).not.toContain('MySecretPassword123');
      expect(sanitized).toContain('password=***');
    });
  });

  describe('handleDatabaseError client response safety', () => {
    it('never exposes SQL queries, internal paths, connection strings, or stack traces to client', () => {
      let statusSent = 0;
      let bodySent: any = null;

      const mockRes: any = {
        status(code: number) {
          statusSent = code;
          return this;
        },
        json(data: any) {
          bodySent = data;
          return this;
        },
      };

      const dangerousError = new Error('SELECT * FROM users WHERE email = \'admin@example.com\' failed: connect ECONNREFUSED 10.0.0.5:5432 at /app/src/server/db/postgres.ts:42:15 password=SecretAdminPass');
      (dangerousError as any).code = 'ECONNREFUSED';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleDatabaseError(mockRes, dangerousError, 'Test Query');

      expect(statusSent).toBe(500);
      expect(bodySent).toEqual({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'A database error occurred. Please try again later.',
        },
      });

      // Confirm nothing leaked in the response JSON
      const jsonString = JSON.stringify(bodySent);
      expect(jsonString).not.toContain('SELECT');
      expect(jsonString).not.toContain('admin@example.com');
      expect(jsonString).not.toContain('10.0.0.5');
      expect(jsonString).not.toContain('SecretAdminPass');
      expect(jsonString).not.toContain('postgres.ts');

      consoleSpy.mockRestore();
    });
  });

  describe('Central Express Error Handling Middleware', () => {
    it('catches database errors and returns safe 500 response', async () => {
      const app = express();
      app.use(express.json());

      app.get('/test-db-fail', asyncHandler(async () => {
        const dbErr = new Error('relation "non_existent_table" does not exist');
        (dbErr as any).code = '42P01';
        throw dbErr;
      }));

      app.use(centralErrorHandler);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app).get('/test-db-fail');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'A database error occurred. Please try again later.',
        },
      });
      expect(JSON.stringify(res.body)).not.toContain('non_existent_table');

      consoleSpy.mockRestore();
    });
  });

  describe('API Routes safe error handling under database failures', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api', apiRouter);

    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      resetRepositories();
      consoleSpy.mockRestore();
    });

    it('returns safe error when signup repository throws database connection error', async () => {
      const failingUserRepo: any = {
        findByEmail: vi.fn().mockRejectedValue(new Error('CRITICAL_DATABASE_ERROR: PostgreSQL connection failed')),
      };

      setRepositoriesForTesting({
        users: failingUserRepo,
      } as any);

      const res = await request(testApp)
        .post('/api/auth/signup')
        .send({
          email: 'safe_err_test@example.com',
          password: 'Password123!',
          displayName: 'Error Tester',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DATABASE_ERROR');
      expect(res.body.error.message).toBe('A database error occurred. Please try again later.');

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('PostgreSQL');
      expect(bodyStr).not.toContain('CRITICAL_DATABASE_ERROR');
    });

    it('returns safe error when task creation repository throws database error', async () => {
      const mockUser: any = {
        id: 'usr_test123',
        email: 'user@example.com',
        role: 'member',
        profile: { displayName: 'Test User' },
        preferences: { theme: 'system' },
        subscription: { tier: 'free', status: 'active' },
        emailVerified: true,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const token = generateToken(mockUser);

      const failingTaskRepo: any = {
        countByUserId: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockRejectedValue({
          code: '23505',
          name: 'DatabaseError',
          message: 'duplicate key value violates unique constraint "tasks_pkey"',
        }),
      };

      const mockUserRepo: any = {
        findById: vi.fn().mockResolvedValue(mockUser),
      };

      setRepositoriesForTesting({
        users: mockUserRepo,
        tasks: failingTaskRepo,
      } as any);

      const res = await request(testApp)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Database failure test task',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DATABASE_ERROR');
      expect(res.body.error.message).toBe('A database error occurred. Please try again later.');

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('tasks_pkey');
      expect(bodyStr).not.toContain('duplicate key');
    });

    it('returns safe error when fetching habits encounters database connection error', async () => {
      const mockUser: any = {
        id: 'usr_test456',
        email: 'user2@example.com',
        role: 'member',
        profile: { displayName: 'Test User 2' },
        preferences: { theme: 'system' },
        subscription: { tier: 'free', status: 'active' },
        emailVerified: true,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const token = generateToken(mockUser);

      const failingHabitRepo: any = {
        findByUserId: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
      };

      const mockUserRepo: any = {
        findById: vi.fn().mockResolvedValue(mockUser),
      };

      setRepositoriesForTesting({
        users: mockUserRepo,
        habits: failingHabitRepo,
      } as any);

      const res = await request(testApp)
        .get('/api/habits')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DATABASE_ERROR');
      expect(res.body.error.message).toBe('A database error occurred. Please try again later.');

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('ECONNREFUSED');
      expect(bodyStr).not.toContain('127.0.0.1:5432');
    });
  });
});
