/**
 * ORIGIN Structured Logger
 * Safe logging system that redacts sensitive keys and obeys environment verbosity settings.
 */
import { envConfig } from '../config/env.config';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'jwt',
  'credential',
]);

function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  debug(message: string, context?: unknown): void {
    if (envConfig.logVerbosity === 'debug') {
      console.debug(`[ORIGIN:DEBUG] ${message}`, context ? sanitizeData(context) : '');
    }
  },

  info(message: string, context?: unknown): void {
    if (['debug', 'info'].includes(envConfig.logVerbosity)) {
      console.info(`[ORIGIN:INFO] ${message}`, context ? sanitizeData(context) : '');
    }
  },

  warn(message: string, context?: unknown): void {
    if (['debug', 'info', 'warn'].includes(envConfig.logVerbosity)) {
      console.warn(`[ORIGIN:WARN] ${message}`, context ? sanitizeData(context) : '');
    }
  },

  error(message: string, error?: unknown): void {
    if (envConfig.logVerbosity !== 'none') {
      console.error(`[ORIGIN:ERROR] ${message}`, error ? sanitizeData(error) : '');
    }
  },
};
