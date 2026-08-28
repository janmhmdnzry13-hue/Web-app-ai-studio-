/**
 * Authentication Service Implementation
 * Communicates strictly with the server-side auth engine (/api/auth/*) with real bcrypt hashes and JWT tokens.
 * Plaintext passwords, mock JWTs, and local user credential stores are strictly prohibited.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { apiClient } from '../lib/api-client';
import { ServiceResult } from '../types/common.types';
import {
  AuthSession,
  AuthState,
  LoginCredentials,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  PasswordResetResponse,
  SessionRestorationResult,
  SignupPayload,
  User,
} from '../types/user.types';
import { BaseService } from './base.service';

export interface IAuthService {
  login(credentials: LoginCredentials): Promise<ServiceResult<AuthSession>>;
  signup(payload: SignupPayload): Promise<ServiceResult<AuthSession>>;
  logout(): Promise<ServiceResult<void>>;
  getCurrentSession(): Promise<ServiceResult<AuthSession | null>>;
  restoreSession(): Promise<SessionRestorationResult>;
  createDemoSession(): Promise<ServiceResult<AuthSession>>;
  requestPasswordReset(payload: PasswordResetRequestPayload): Promise<ServiceResult<PasswordResetResponse>>;
  confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<ServiceResult<{ success: boolean; message: string }>>;
}

export class AuthService extends BaseService implements IAuthService {
  async login(credentials: LoginCredentials): Promise<ServiceResult<AuthSession>> {
    try {
      const email = credentials.email?.trim().toLowerCase();
      const password = credentials.password ?? '';

      if (!email) {
        return this.failure('AUTH_INVALID_EMAIL', 'Email address is required.');
      }
      if (!password) {
        return this.failure('AUTH_INVALID_PASSWORD', 'Password is required.');
      }

      const res = await apiClient.post<AuthSession>('/api/auth/login', { email, password });
      if (res.success && res.data) {
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, res.data);
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, res.data.token);
        return this.success(res.data);
      }

      const errorCode = res.error?.code || 'AUTH_INVALID_CREDENTIALS';
      const errorMessage = res.error?.message || 'Invalid email or password.';
      return this.failure(errorCode, errorMessage);
    } catch (err: any) {
      return this.failure('AUTH_ERROR', err.message || 'Authentication failed unexpectedly', { err });
    }
  }

  async signup(payload: SignupPayload): Promise<ServiceResult<AuthSession>> {
    try {
      const email = payload.email?.trim().toLowerCase();
      const displayName = payload.displayName?.trim();
      const password = payload.password ?? '';

      if (!email || !email.includes('@')) {
        return this.failure('AUTH_INVALID_EMAIL', 'A valid email address is required.');
      }
      if (!displayName || displayName.length < 2) {
        return this.failure('AUTH_INVALID_NAME', 'Display name must be at least 2 characters.');
      }
      if (password.length < 6) {
        return this.failure('AUTH_WEAK_PASSWORD', 'Password must be at least 6 characters.');
      }

      const res = await apiClient.post<AuthSession>('/api/auth/signup', { email, displayName, password });
      if (res.success && res.data) {
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, res.data);
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, res.data.token);
        return this.success(res.data);
      }

      const errorCode = res.error?.code || 'SIGNUP_FAILED';
      const errorMessage = res.error?.message || 'Failed to create account.';
      return this.failure(errorCode, errorMessage);
    } catch (err: any) {
      return this.failure('AUTH_ERROR', err.message || 'Signup failed unexpectedly', { err });
    }
  }

  async logout(): Promise<ServiceResult<void>> {
    try {
      await apiClient.post('/api/auth/logout').catch(() => null);
    } catch {
      // Ignore network errors during logout
    } finally {
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    }
    return this.success(undefined);
  }

  async getCurrentSession(): Promise<ServiceResult<AuthSession | null>> {
    return this.restoreSession().then((res) => {
      if (res.status === 'AUTHENTICATED' && res.session) {
        return { success: true, data: res.session };
      }
      return {
        success: false,
        data: null,
        error: {
          code: res.status,
          message: res.error || 'Session verification failed.',
          timestamp: new Date().toISOString(),
        },
      };
    });
  }

  async restoreSession(): Promise<SessionRestorationResult> {
    const cachedSession = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
    const token = safeStorage.get<string | null>(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null) || cachedSession?.token;

    // No active session or token stored
    if (!token) {
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      return {
        status: 'UNAUTHENTICATED',
        session: null,
        error: 'No active session found.',
      };
    }

    // Validate client-side expiration timestamp if present
    if (cachedSession?.expiresAt && new Date(cachedSession.expiresAt).getTime() < Date.now()) {
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      return {
        status: 'TOKEN_EXPIRED',
        session: null,
        error: 'Session has expired. Please sign in again.',
      };
    }

    try {
      // Validate session strictly with the server authority (/api/auth/session)
      const res = await apiClient.get<AuthSession>('/api/auth/session');
      if (res.success && res.data && res.data.token && res.data.user) {
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, res.data);
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, res.data.token);
        return {
          status: 'AUTHENTICATED',
          session: res.data,
        };
      }

      if (res.error) {
        const code = res.error.code;

        // Server confirmed that session/token is invalid or expired
        if (
          code === 'UNAUTHORIZED' ||
          code === 'INVALID_TOKEN' ||
          code === 'TOKEN_INVALID' ||
          code === 'TOKEN_EXPIRED' ||
          code === 'USER_NOT_FOUND' ||
          code.startsWith('HTTP_401') ||
          code.startsWith('HTTP_403')
        ) {
          safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
          safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);

          const status: AuthState =
            code === 'TOKEN_EXPIRED'
              ? 'TOKEN_EXPIRED'
              : code === 'INVALID_TOKEN' || code === 'TOKEN_INVALID' || code === 'USER_NOT_FOUND'
              ? 'TOKEN_INVALID'
              : 'UNAUTHENTICATED';

          return {
            status,
            session: null,
            error: res.error.message || 'Session is invalid or expired on server authority.',
          };
        }

        // Backend unreachable / network error:
        // CRITICAL: The browser cache MUST NOT act as an authentication authority.
        if (code === 'NETWORK_ERROR') {
          return {
            status: 'NETWORK_ERROR',
            session: null,
            error: 'Authentication server is unreachable. Cannot verify session authenticity.',
          };
        }

        return {
          status: 'UNAUTHENTICATED',
          session: null,
          error: res.error.message || 'Session verification failed.',
        };
      }

      return {
        status: 'UNAUTHENTICATED',
        session: null,
        error: 'Unable to verify session with server authority.',
      };
    } catch (err: any) {
      return {
        status: 'NETWORK_ERROR',
        session: null,
        error: err.message || 'Network error during session verification.',
      };
    }
  }

  /**
   * Helper for read-only UI continuity only (e.g. displaying username while offline).
   * Note: This does NOT grant authentication authority or allow protected mutations.
   */
  getCachedUserForUI(): User | null {
    const cachedSession = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
    if (!cachedSession || !cachedSession.user) return null;
    if (cachedSession.expiresAt && new Date(cachedSession.expiresAt).getTime() < Date.now()) {
      return null;
    }
    return cachedSession.user;
  }

  async createDemoSession(): Promise<ServiceResult<AuthSession>> {
    try {
      const res = await apiClient.post<AuthSession>('/api/auth/demo');
      if (res.success && res.data) {
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, res.data);
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, res.data.token);
        return this.success(res.data);
      }
      return this.failure('AUTH_ERROR', res.error?.message || 'Failed to create demo session.');
    } catch (err: any) {
      return this.failure('AUTH_ERROR', err.message || 'Failed to create demo session');
    }
  }

  async requestPasswordReset(payload: PasswordResetRequestPayload): Promise<ServiceResult<PasswordResetResponse>> {
    try {
      const res = await apiClient.post<PasswordResetResponse>('/api/auth/password-reset-request', payload);
      if (res.success && res.data) {
        return this.success(res.data);
      }
      return this.failure(res.error?.code || 'RESET_REQUEST_FAILED', res.error?.message || 'Password reset request failed.');
    } catch (err: any) {
      return this.failure('AUTH_ERROR', err.message || 'Password reset request failed.');
    }
  }

  async confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<ServiceResult<{ success: boolean; message: string }>> {
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>('/api/auth/password-reset-confirm', payload);
      if (res.success && res.data) {
        return this.success(res.data);
      }
      return this.failure(res.error?.code || 'RESET_CONFIRM_FAILED', res.error?.message || 'Password reset confirmation failed.');
    } catch (err: any) {
      return this.failure('AUTH_ERROR', err.message || 'Password reset confirmation failed.');
    }
  }
}

export const authService = new AuthService();
