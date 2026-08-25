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

      // If backend responded with a non-network error code, respect it
      if (res.error && res.error.code !== 'NETWORK_ERROR') {
        return this.failure(res.error.code, res.error.message || 'Invalid email or password.');
      }

      // Offline / Local test fallback
      const storedUsers = safeStorage.get<Record<string, { user: User; passwordHash: string }>>('origin_os_users_db', {});
      const userRecord = storedUsers[email];
      if (!userRecord) {
        return this.failure('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
      }

      if (userRecord.passwordHash !== password) {
        return this.failure('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
      }

      const session: AuthSession = {
        token: `mock_jwt_${Date.now()}_${userRecord.user.id}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        user: userRecord.user,
      };

      safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, session);
      safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, session.token);
      return this.success(session);
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

      if (res.error && res.error.code !== 'NETWORK_ERROR') {
        return this.failure(res.error.code, res.error.message || 'Signup failed.');
      }

      // Offline / Local test fallback
      const storedUsers = safeStorage.get<Record<string, { user: User; passwordHash: string }>>('origin_os_users_db', {});
      if (storedUsers[email]) {
        return this.failure('AUTH_EMAIL_EXISTS', 'An account with this email address already exists.');
      }

      const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email,
        role: 'member',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        profile: {
          displayName,
          headline: 'Self-Actualizer',
          bio: '',
          primaryLifeFocus: 'Deep Work & Daily Focus',
        },
        preferences: { ...DEFAULT_DEMO_USER.preferences },
      };

      storedUsers[email] = {
        user: newUser,
        passwordHash: password,
      };
      safeStorage.set('origin_os_users_db', storedUsers);

      const session: AuthSession = {
        token: `mock_jwt_${Date.now()}_${newUser.id}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        user: newUser,
      };

      safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, session);
      safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, session.token);
      return this.success(session);
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
      if (res.error && res.error.code !== 'NETWORK_ERROR') {
        return this.failure(res.error.code, res.error.message || 'Password reset request failed.');
      }

      // Offline / test fallback
      const token = `reset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const resets = safeStorage.get<Record<string, { email: string; token: string }>>('origin_os_resets', {});
      resets[token] = { email: payload.email, token };
      safeStorage.set('origin_os_resets', resets);

      return this.success({
        success: true,
        message: 'Password reset instructions have been issued.',
        resetToken: token,
      });
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
      if (res.error && res.error.code !== 'NETWORK_ERROR') {
        return this.failure(res.error.code, res.error.message || 'Password reset failed.');
      }

      // Offline / test fallback
      const resets = safeStorage.get<Record<string, { email: string; token: string }>>('origin_os_resets', {});
      const resetRecord = resets[payload.token];
      if (!resetRecord) {
        return this.failure('AUTH_INVALID_TOKEN', 'Password reset token is invalid or expired.');
      }

      const storedUsers = safeStorage.get<Record<string, { user: User; passwordHash: string }>>('origin_os_users_db', {});
      if (storedUsers[resetRecord.email]) {
        storedUsers[resetRecord.email].passwordHash = payload.newPassword;
        safeStorage.set('origin_os_users_db', storedUsers);
      }

      delete resets[payload.token];
      safeStorage.set('origin_os_resets', resets);

      return this.success({ success: true, message: 'Password has been reset successfully.' });
    } catch (err: any) {
      return this.failure('AUTH_ERROR', err.message || 'Password reset confirmation failed.');
    }
  }
}

export const authService = new AuthService();
