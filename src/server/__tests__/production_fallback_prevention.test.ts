import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  getActiveRepositories,
  determineActiveEngine,
  resetRepositories,
  setStorageEngineForTesting,
  setRepositoriesForTesting,
} from '../repositories';
import {
  setDbPoolForTesting,
  isProductionEnvironment,
  isPostgresConfigured,
  sanitizeDatabaseError,
  query,
} from '../db/postgres';
import { db } from '../db';
import { PostgresTaskRepository } from '../repositories/postgres/task.repository';

describe('Production Fallback Prevention & Database Safety Policy', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalPgHost = process.env.PGHOST;
  const originalPgDatabase = process.env.PGDATABASE;
  const originalPgUser = process.env.PGUSER;
  const originalPgPassword = process.env.PGPASSWORD;

  const dbFilePath = path.join(process.cwd(), 'data', 'origin_db.json');

  beforeEach(() => {
    resetRepositories();
    setDbPoolForTesting(null);
    setStorageEngineForTesting(null);
    setRepositoriesForTesting(null);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;

    if (originalPgHost) process.env.PGHOST = originalPgHost;
    else delete process.env.PGHOST;

    if (originalPgDatabase) process.env.PGDATABASE = originalPgDatabase;
    else delete process.env.PGDATABASE;

    if (originalPgUser) process.env.PGUSER = originalPgUser;
    else delete process.env.PGUSER;

    if (originalPgPassword) process.env.PGPASSWORD = originalPgPassword;
    else delete process.env.PGPASSWORD;

    resetRepositories();
    setDbPoolForTesting(null);
    setStorageEngineForTesting(null);
    setRepositoriesForTesting(null);
  });

  it('1. PostgreSQL available → repository uses PostgreSQL engine', async () => {
    const executedQueries: string[] = [];

    const mockPool = {
      query: async (text: string, params?: any[]) => {
        executedQueries.push(text);
        if (text.includes('FROM task_subtasks')) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [
            {
              id: 'task_pg_100',
              user_id: 'usr_pg_1',
              title: 'PostgreSQL Task Execution',
              description: 'Executed directly in Postgres',
              priority: 'high',
              status: 'todo',
              due_date: '2026-09-01',
              estimated_minutes: 45,
              actual_minutes: null,
              tags: ['production'],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        };
      },
    } as unknown as Pool;

    setDbPoolForTesting(mockPool);
    setStorageEngineForTesting('postgres');

    const taskRepo = new PostgresTaskRepository();
    const result = await taskRepo.findById('task_pg_100', 'usr_pg_1');

    expect(executedQueries.length).toBeGreaterThanOrEqual(1);
    expect(executedQueries.some((sql) => sql.includes('SELECT * FROM tasks WHERE id = $1'))).toBe(true);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('PostgreSQL Task Execution');
    expect(result?.userId).toBe('usr_pg_1');
  });

  it('2. PostgreSQL unavailable in production → throws controlled server error and prohibits silent JSON fallback', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;
    delete process.env.PGDATABASE;
    setDbPoolForTesting(null);
    setStorageEngineForTesting(null);
    resetRepositories();

    expect(isProductionEnvironment()).toBe(true);
    expect(isPostgresConfigured()).toBe(false);

    // Active engine in production is strictly 'postgres'
    expect(determineActiveEngine()).toBe('postgres');

    // Attempting to obtain repositories in production without PostgreSQL configuration throws a controlled error
    expect(() => getActiveRepositories()).toThrowError(
      /CRITICAL_DATABASE_ERROR: PostgreSQL connection configuration \(DATABASE_URL\) is required in production environment/i
    );
  });

  it('3. PostgreSQL unavailable in production → origin_db.json is NOT written or modified', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;
    delete process.env.PGDATABASE;
    setDbPoolForTesting(null);
    resetRepositories();

    let initialFileMtime: number | null = null;
    let initialFileContent: string | null = null;

    if (fs.existsSync(dbFilePath)) {
      const stat = fs.statSync(dbFilePath);
      initialFileMtime = stat.mtimeMs;
      initialFileContent = fs.readFileSync(dbFilePath, 'utf8');
    }

    // Call save operations on DatabaseEngine during simulated production mode
    await db.save();

    if (fs.existsSync(dbFilePath) && initialFileMtime !== null) {
      const currentStat = fs.statSync(dbFilePath);
      const currentContent = fs.readFileSync(dbFilePath, 'utf8');
      expect(currentStat.mtimeMs).toBe(initialFileMtime);
      expect(currentContent).toBe(initialFileContent);
    }
  });

  it('4. PostgreSQL query failure in production → no JSON fallback occurs and error is rethrown cleanly', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://postgres:prod_secret_pw@db.internal:5432/origin_db';

    const mockPool = {
      query: async () => {
        throw new Error('Connection terminated unexpectedly: server closed the connection');
      },
    } as unknown as Pool;

    setDbPoolForTesting(mockPool);
    setStorageEngineForTesting('postgres');

    const taskRepo = new PostgresTaskRepository();

    // Verify query failure throws directly without catching and writing to JSON
    await expect(taskRepo.findById('task_any', 'usr_1')).rejects.toThrowError(
      /Connection terminated unexpectedly/i
    );
  });

  it('5. Development/test behavior remains compatible with the existing project architecture (JSON fallback active in dev)', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;
    delete process.env.PGDATABASE;
    setDbPoolForTesting(null);
    setStorageEngineForTesting(null);
    resetRepositories();

    expect(isProductionEnvironment()).toBe(false);
    expect(isPostgresConfigured()).toBe(false);

    // In dev/test without PG, determineActiveEngine cleanly resolves to 'json'
    expect(determineActiveEngine()).toBe('json');

    const activeRepos = getActiveRepositories();
    expect(activeRepos).toBeDefined();
    expect(activeRepos.tasks).toBeDefined();
    expect(activeRepos.users).toBeDefined();
  });

  it('6. Database credentials and connection strings are sanitized and never exposed in error messages', () => {
    const rawErrorWithUrl = new Error(
      'Failed to connect to postgresql://origin_admin:super_secret_master_password_2026@postgres.internal.net:5432/origin_prod?sslmode=require'
    );
    const sanitizedUrlErr = sanitizeDatabaseError(rawErrorWithUrl);

    expect(sanitizedUrlErr.message).not.toContain('super_secret_master_password_2026');
    expect(sanitizedUrlErr.message).toContain('postgresql://***:***@postgres.internal.net:5432/origin_prod?sslmode=require');

    const rawErrorWithParam = new Error(
      'connection error: host=db.internal port=5432 password=my_db_secret_key_xyz dbname=origin_db'
    );
    const sanitizedParamErr = sanitizeDatabaseError(rawErrorWithParam);

    expect(sanitizedParamErr.message).not.toContain('my_db_secret_key_xyz');
    expect(sanitizedParamErr.message).toContain('password=***');
  });
});
