/**
 * Authentication Service Implementation
 * Communicates with the real server-side auth engine (/api/auth/*) with real bcrypt hashes and JWT tokens.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { apiClient } from '../lib/api-client';
import { ServiceResult } from '../types/common.types';
import {
  AuthSession,
  LoginCredentials,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  PasswordResetResponse,
  SignupPayload,
  User,
} from '../types/user.types';
import { BaseService } from './base.service';

export interface IAuthService {
  login(credentials: LoginCredentials): Promise<ServiceResult<AuthSession>>;
  signup(payload: SignupPayload): Promise<ServiceResult<AuthSession>>;
  logout(): Promise<ServiceResult<void>>;
  getCurrentSession(): Promise<ServiceResult<AuthSession | null>>;
  createDemoSession(): Promise<ServiceResult<AuthSession>>;
  requestPasswordReset(payload: PasswordResetRequestPayload): Promise<ServiceResult<PasswordResetResponse>>;
  confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<ServiceResult<{ success: boolean; message: string }>>;
}

export const DEFAULT_DEMO_USER: User = Object.freeze({
  id: 'usr_origin_demo',
  email: 'alex.vance@origin-os.internal',
  role: 'member',
  emailVerified: true,
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-08-21T08:00:00.000Z',
  lastLoginAt: '2026-08-21T09:30:00.000Z',
  profile: {
    displayName: 'Alex Vance',
    headline: 'Lead Architect',
    bio: 'Designing deliberate personal operating systems.',
    primaryLifeFocus: 'Deep Work & Daily Focus',
  },
  preferences: {
    theme: 'system' as const,
    timezone: 'America/New_York',
    locale: 'en-US',
    weekStartDay: 1 as const,
    reducedMotion: false,
    compactDensity: false,
    dailyReflectionReminderTime: '21:30',
    notificationChannels: {
      inApp: true,
      email: false,
      dailyDigest: true,
    },
  },
});

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

      return this.failure(res.error?.code || 'AUTH_INVALID_CREDENTIALS', res.error?.message || 'Invalid email or password.');
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

      return this.failure(res.error?.code || 'AUTH_EMAIL_EXISTS', res.error?.message || 'Signup failed.');
    } catch (err: any) {
      return this.failure('AUTH_ERROR', err.message || 'Signup failed unexpectedly', { err });
    }
  }

  async logout(): Promise<ServiceResult<void>> {
    safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
    safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    return this.success(undefined);
  }

  async getCurrentSession(): Promise<ServiceResult<AuthSession | null>> {
    const cachedSession = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
    if (!cachedSession) return this.success(null);

    // Validate expiration
    if (new Date(cachedSession.expiresAt).getTime() < Date.now()) {
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      return this.success(null);
    }

    try {
      // Sync fresh session and user profile from real backend
      const res = await apiClient.get<AuthSession>('/api/auth/session');
      if (res.success && res.data) {
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, res.data);
        return this.success(res.data);
      }
    } catch {
      // Offline fallback: keep cached session if valid
    }

    return this.success(cachedSession);
  }

  async createDemoSession(): Promise<ServiceResult<AuthSession>> {
    try {
      const res = await apiClient.post<AuthSession>('/api/auth/demo');
      if (res.success && res.data) {
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, res.data);
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, res.data.token);
        return this.success(res.data);
      }
      return this.failure('AUTH_ERROR', 'Failed to create demo session.');
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
      return this.failure(res.error?.code || 'AUTH_ERROR', res.error?.message || 'Password reset request failed.');
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
      return this.failure(res.error?.code || 'AUTH_ERROR', res.error?.message || 'Password reset failed.');
    } catch (err: any) {
      return this.failure('AUTH_ERROR', err.message || 'Password reset confirmation failed.');
    }
  }
}

export const authService = new AuthService();
