import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Standard client error response payload.
 */
export interface SafeClientErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Checks if an error represents a database, persistence, connection, or repository failure.
 */
export function isDatabaseError(error: any): boolean {
  if (!error) return false;

  const message = (typeof error === 'string' ? error : error?.message || '').toLowerCase();
  const name = (error?.name || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();

  // PostgreSQL error codes or typical connection error codes
  const isPgCode =
    code.startsWith('28') || // Invalid authorization / credentials
    code.startsWith('08') || // Connection exception
    code.startsWith('3D') || // Invalid catalog name / database does not exist
    code.startsWith('42') || // Syntax error or access rule violation
    code.startsWith('23') || // Integrity constraint violation
    code.startsWith('57') || // Operator intervention (query canceled, admin shutdown)
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH';

  const isDbName =
    name === 'databaseerror' ||
    name === 'postgreserror' ||
    name === 'pgerror';

  const isDbMessage =
    message.includes('critical_database_error') ||
    message.includes('postgresql') ||
    message.includes('postgres') ||
    message.includes('database') ||
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('ehostunreach') ||
    message.includes('connection terminated') ||
    message.includes('connection closed') ||
    message.includes('connection reset') ||
    message.includes('relation') ||
    message.includes('syntax error at or near') ||
    message.includes('duplicate key') ||
    message.includes('foreign key') ||
    message.includes('client has already been connected') ||
    message.includes('pool is closed') ||
    message.includes('terminat') ||
    message.includes('timeout') ||
    message.includes('pg_');

  return isPgCode || isDbName || isDbMessage;
}

/**
 * Strips all database secrets, connection URIs, credentials, and passwords from logs and messages.
 */
export function sanitizeLogContent(input: any): string {
  const text = typeof input === 'string' ? input : (input?.stack || input?.message || String(input));
  return text
    .replace(/(?:password|pwd|secret|auth|token)=[^;&\s]+/gi, 'password=***')
    .replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi, 'postgresql://***:***@')
    .replace(/:\/\/[^:]+:[^@]+@/g, '://***:***@');
}

/**
 * Central handler for database and repository errors.
 * Logs sanitized diagnostics on the server while returning a safe HTTP 500 JSON response to the client.
 * Strictly avoids exposing SQL queries, connection details, credentials, or internal stack traces.
 */
export function handleDatabaseError(
  res: Response,
  error: any,
  contextLabel: string = 'Database Operation'
): void {
  // Safe server-side diagnostic logging (strictly free of passwords/credentials)
  const sanitized = sanitizeLogContent(error);
  console.error(`[Database Error][${contextLabel}]:`, sanitized);

  // Return a consistent, safe error response
  res.status(500).json({
    success: false,
    error: {
      code: 'DATABASE_ERROR',
      message: 'A database error occurred. Please try again later.',
    },
  });
}

/**
 * Express error middleware to catch unhandled errors from any route.
 */
export function centralErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(err);
  }

  const endpoint = `${req.method} ${req.originalUrl || req.url || req.path}`;

  if (isDatabaseError(err)) {
    handleDatabaseError(res, err, endpoint);
    return;
  }

  // Other non-database errors:
  const sanitized = sanitizeLogContent(err);
  console.error(`[Server Error][${endpoint}]:`, sanitized);

  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected internal server error occurred.',
    },
  });
}

/**
 * Async handler wrapper to ensure async rejections are caught and forwarded to the central error handler.
 */
export function asyncHandler(
  fn: (req: any, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (isDatabaseError(err)) {
        const endpoint = `${req.method} ${req.originalUrl || req.url || req.path}`;
        handleDatabaseError(res, err, endpoint);
      } else {
        next(err);
      }
    });
  };
}
