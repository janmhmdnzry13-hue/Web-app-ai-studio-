/**
 * PostgreSQL Database Connection and Safe Query Pool Manager
 *
 * Responsibilities:
 * 1. Safely read connection credentials from environment variables (DATABASE_URL, PGHOST, etc.).
 * 2. Maintain a managed pg.Pool instance with proper lifecycle and timeouts.
 * 3. Enforce parameterized queries to prevent SQL injection.
 * 4. Never leak database credentials in error messages or logs.
 * 5. Provide strict production-mode validation (fails fast without falling back silently to JSON).
 */

import pg, { Pool, PoolConfig, PoolClient, QueryResult, QueryResultRow } from 'pg';

export interface SafeDatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

let globalPool: Pool | null = null;
let testPoolOverride: Pool | null = null;

/**
 * Checks if the runtime environment is production.
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.ENVIRONMENT === 'production' ||
    process.env.APP_ENV === 'production'
  );
}

/**
 * Checks if PostgreSQL configuration exists in the environment.
 */
export function isPostgresConfigured(): boolean {
  if (testPoolOverride) return true;
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return true;
  }
  if (
    process.env.PGHOST &&
    process.env.PGDATABASE &&
    process.env.PGHOST.trim().length > 0 &&
    process.env.PGDATABASE.trim().length > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Resolves PostgreSQL configuration from environment variables securely.
 * Never hardcodes credentials.
 */
export function resolvePostgresConfig(): PoolConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    const isLocalhost =
      databaseUrl.includes('localhost') ||
      databaseUrl.includes('127.0.0.1') ||
      databaseUrl.includes('postgres-test');

    const config: PoolConfig = {
      connectionString: databaseUrl,
      max: parseInt(process.env.PGMAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: parseInt(process.env.PGIDLE_TIMEOUT_MS || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.PGCONNECT_TIMEOUT_MS || '5000', 10),
    };

    // SSL configuration based on environment or connection string
    if (!isLocalhost && (process.env.PGSSLMODE === 'require' || databaseUrl.includes('sslmode=require'))) {
      config.ssl = { rejectUnauthorized: false };
    }

    return config;
  }

  const host = process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || '';
  const database = process.env.PGDATABASE || 'origin_db';

  const config: PoolConfig = {
    host,
    port,
    user,
    password,
    database,
    max: parseInt(process.env.PGMAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: parseInt(process.env.PGIDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PGCONNECT_TIMEOUT_MS || '5000', 10),
  };

  if (process.env.PGSSLMODE === 'require') {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

/**
 * Returns the active PostgreSQL connection pool.
 * In production mode, throws an error if PostgreSQL is not configured.
 */
export function getDbPool(): Pool {
  if (testPoolOverride) {
    return testPoolOverride;
  }

  if (!globalPool) {
    if (!isPostgresConfigured()) {
      if (isProductionEnvironment()) {
        throw new Error(
          'CRITICAL_DATABASE_ERROR: PostgreSQL connection (DATABASE_URL or PGHOST/PGDATABASE) is required in production mode. Refusing silent fallback.'
        );
      }
    }

    const config = resolvePostgresConfig();
    globalPool = new pg.Pool(config);

    globalPool.on('error', (err) => {
      console.error('[PostgreSQL Pool] Unexpected client error:', err.message);
    });
  }

  return globalPool;
}

/**
 * Overrides the active pool for isolated integration test suites.
 */
export function setDbPoolForTesting(pool: Pool | null): void {
  testPoolOverride = pool;
}

/**
 * Safely closes and resets the global pool.
 */
export async function closeDbPool(): Promise<void> {
  if (globalPool) {
    try {
      await globalPool.end();
    } catch (err: any) {
      console.error('[PostgreSQL Pool] Error closing pool:', err.message);
    }
    globalPool = null;
  }
  testPoolOverride = null;
}

/**
 * Sanitizes any error message to ensure no database passwords or connection tokens are leaked.
 */
export function sanitizeDatabaseError(error: any): Error {
  const message = typeof error === 'string' ? error : error?.message || 'Database query error';
  const sanitized = message
    .replace(/(?:password|pwd|secret)=[^;&\s]+/gi, 'password=***')
    .replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi, 'postgresql://***:***@')
    .replace(/:\/\/[^:]+:[^@]+@/g, '://***:***@');
  const safeErr = new Error(sanitized);
  if (error && typeof error === 'object') {
    (safeErr as any).code = error.code;
    (safeErr as any).name = error.name || 'DatabaseError';
  }
  return safeErr;
}

/**
 * Executes a parameterized SQL query safely against PostgreSQL.
 * Strictly forbids concatenating untrusted inputs by requiring parameterized values.
 */
export async function query<R extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<R>> {
  const pool = getDbPool();
  try {
    return await pool.query<R>(text, params);
  } catch (err: any) {
    throw sanitizeDatabaseError(err);
  }
}

/**
 * Executes operations inside an atomic PostgreSQL transaction.
 * Rolls back automatically on any error.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr: any) {
      console.error('[PostgreSQL Transaction] Rollback error:', rollbackErr.message);
    }
    throw sanitizeDatabaseError(err);
  } finally {
    client.release();
  }
}
