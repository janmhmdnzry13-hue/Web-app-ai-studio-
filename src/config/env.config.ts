/**
 * ORIGIN Configuration - Safe Environment Variables
 * Strict validation and fallback handling for runtime environment settings.
 * Client code must NEVER read process.env directly; use this typed config instead.
 */

export interface EnvConfig {
  readonly appName: string;
  readonly appVersion: string;
  readonly appUrl: string;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly enableAiFeatures: boolean;
  readonly enableMockServices: boolean;
  readonly logVerbosity: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

function getEnvString(key: string, fallback: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val;
    }
  }
  return fallback;
}

export const envConfig: EnvConfig = Object.freeze({
  appName: 'ORIGIN',
  appVersion: '0.1.0-alpha',
  appUrl: getEnvString('VITE_APP_URL', window?.location?.origin || 'http://localhost:3000'),
  isProduction: import.meta.env.MODE === 'production',
  isDevelopment: import.meta.env.MODE !== 'production',
  enableAiFeatures: true,
  enableMockServices: true, // Phase 1 uses in-memory / structured mock service providers
  logVerbosity: import.meta.env.MODE === 'production' ? 'warn' : 'info',
});
