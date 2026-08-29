import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { db } from '../db';
import { generateToken, generateCryptoToken, hashPassword } from '../auth';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Strict Server-Side Schema Validation', () => {
  let authToken: string;
  let testUserId: string;

  beforeEach(() => {
    testUserId = generateCryptoToken('usr_test');
    const testUser = {
      id: testUserId,
      email: `validation.test.${Date.now()}@origin-os.internal`,
      passwordHash: hashPassword('ValidPass123!'),
      role: 'member' as const,
      emailVerified: true,
      profile: {
        displayName: 'Validator Tester',
        headline: 'QA Engineer',
        bio: 'Testing strict schema validation',
        primaryLifeFocus: 'Deep Work & Daily Focus',
      },
      preferences: {
        theme: 'system' as const,
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1 as const,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: '21:00',
        notificationChannels: { inApp: true, email: false, dailyDigest: true },
        unlockedModules: ['tasks', 'habits', 'finances', 'goals'],
      },
      subscription: { tier: 'pro' as const, status: 'active' as const },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.users.push(testUser);
    authToken = generateToken(testUser);
  });

  describe('Authentication Endpoints Schema Validation', () => {
    it('rejects signup with missing required fields', async () => {
      const res = await request(app).post('/api/auth/signup').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('rejects signup with invalid email type or malformed email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: 'ValidPassword123!', displayName: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_EMAIL');
    });

    it('rejects signup with short password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'valid@example.com', password: '123', displayName: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('rejects login with missing email or password', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('rejects password-reset-request with invalid email', async () => {
      const res = await request(app).post('/api/auth/password-reset-request').send({ email: 'not-email' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_EMAIL');
    });

    it('rejects password-reset-confirm with missing token or weak password', async () => {
      const res = await request(app).post('/api/auth/password-reset-confirm').send({ token: '', newPassword: '12' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('Tasks Endpoint Schema Validation', () => {
    it('rejects task creation with missing title', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No title provided' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TITLE');
    });

    it('rejects task creation with invalid enum value for priority', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Task Title', priority: 'super-urgent' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
      expect(res.body.error.details.some((d: any) => d.field === 'priority')).toBe(true);
    });

    it('rejects task creation with invalid data type for estimatedMinutes', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Task Title', estimatedMinutes: 'not-a-number' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects task creation with negative estimatedMinutes', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Task Title', estimatedMinutes: -10 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects task creation with invalid data type for tags', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Task Title', tags: 'should-be-array-not-string' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects task status update with invalid enum value', async () => {
      const res = await request(app)
        .patch('/api/tasks/tsk_123/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'done_and_finished' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('accepts valid task creation and sets properties correctly', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Review System Specs',
          description: 'Ensure validation coverage',
          priority: 'high',
          estimatedMinutes: 45,
          tags: ['architecture', 'security'],
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Review System Specs');
      expect(res.body.data.priority).toBe('high');
      expect(res.body.data.estimatedMinutes).toBe(45);
    });
  });

  describe('Habits Endpoint Schema Validation', () => {
    it('rejects habit creation with missing name', async () => {
      const res = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'deep_work' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_NAME');
    });

    it('rejects habit creation with invalid frequency enum', async () => {
      const res = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Morning Meditation', frequency: 'bi-weekly' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects habit log with missing habitId', async () => {
      const res = await request(app)
        .post('/api/habits/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: true });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('Goals Endpoint Schema Validation', () => {
    it('rejects goal creation with missing title', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Missing title' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TITLE');
    });

    it('rejects goal creation with invalid category enum', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Ship Feature', category: 'unknown_category' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('Finances Endpoint Schema Validation', () => {
    it('rejects transaction with missing title or amount', async () => {
      const res = await request(app)
        .post('/api/finances/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Coffee' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects transaction with non-numerical amount', async () => {
      const res = await request(app)
        .post('/api/finances/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Coffee', amount: 'ten-dollars' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects transaction with invalid transaction type', async () => {
      const res = await request(app)
        .post('/api/finances/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Coffee', amount: 5.5, type: 'transfer' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('accepts valid transaction', async () => {
      const res = await request(app)
        .post('/api/finances/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Hosting Server', amount: 20, type: 'expense', category: 'Technology' });
      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(20);
      expect(res.body.data.type).toBe('expense');
    });
  });

  describe('User Preferences Schema Validation', () => {
    it('rejects invalid theme enum', async () => {
      const res = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ theme: 'solarized-dark' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects invalid weekStartDay value', async () => {
      const res = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ weekStartDay: 3 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('Relationships Endpoint Schema Validation', () => {
    it('rejects relationship with missing name', async () => {
      const res = await request(app)
        .post('/api/relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ relationType: 'colleague' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_NAME');
    });

    it('rejects relationship with invalid relationType enum', async () => {
      const res = await request(app)
        .post('/api/relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Jordan', relationType: 'rival' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('Billing Endpoint Schema Validation', () => {
    it('rejects checkout with invalid interval enum', async () => {
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 'weekly' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });
  });
});
