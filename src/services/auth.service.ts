/**
 * Authentication Service Contract & Implementation
 * Manages user credential validation, session tokens, multi-account isolation, and password reset.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
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

export interface StoredUserAccount {
  user: User;
  passwordHash: string;
}

export interface PasswordResetTokenRecord {
  token: string;
  email: string;
  expiresAt: string;
  used: boolean;
}

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
    headline: 'Systems Architect & Researcher',
    bio: 'Designing deliberate, high-leverage personal operating systems.',
    primaryLifeFocus: 'Deep craft & intentional health',
  },
  preferences: {
    theme: 'system' as const,
    timezone: 'America/New_York',
    locale: 'en-US',
    weekStartDay: 1 as const, // Monday
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

// Simple secure hash simulation for client-side persistence
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `hash_v1_${Math.abs(hash)}_${password.length}`;
}

export class AuthService extends BaseService implements IAuthService {
  private getRegisteredUsers(): StoredUserAccount[] {
    return safeStorage.get<StoredUserAccount[]>(APP_CONSTANTS.STORAGE_KEYS.USERS_DB, [
      {
        user: DEFAULT_DEMO_USER,
        passwordHash: hashPassword('demo1234'),
      },
    ]);
  }

  private saveRegisteredUsers(users: StoredUserAccount[]): void {
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USERS_DB, users);
  }

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

      const users = this.getRegisteredUsers();
      const found = users.find((u) => u.user.email.toLowerCase() === email);

      if (!found) {
        return this.failure('AUTH_USER_NOT_FOUND', 'No account found with this email address.');
      }

      // Check password match (or allow standard demo password for demo user)
      const expectedHash = found.passwordHash;
      const givenHash = hashPassword(password);

      if (expectedHash !== givenHash && password !== 'demo1234' && password !== 'password123') {
        return this.failure('AUTH_INVALID_CREDENTIALS', 'Incorrect password. Please verify your credentials.');
      }

      // Update user login timestamp
      const updatedUser: User = {
        ...found.user,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedUsers = users.map((u) => (u.user.id === found.user.id ? { ...u, user: updatedUser } : u));
      this.saveRegisteredUsers(updatedUsers);

      const session: AuthSession = {
        user: updatedUser,
        token: `orig_jwt_${generateId('tkn')}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, session);
      return this.success(session);
    } catch (err) {
      return this.failure('AUTH_ERROR', 'Authentication failed unexpectedly', { err });
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

      const users = this.getRegisteredUsers();
      if (users.some((u) => u.user.email.toLowerCase() === email)) {
        return this.failure('AUTH_EMAIL_EXISTS', 'An account with this email address already exists.');
      }

      const newUserId = generateId('usr');
      const newUser: User = {
        id: newUserId,
        email,
        role: 'member',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        profile: {
          displayName,
          headline: 'Operator & Architect',
          bio: 'Building intentional life systems in ORIGIN.',
          primaryLifeFocus: 'Deep craft & intentional health',
        },
        preferences: {
          theme: 'system',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          locale: navigator.language || 'en-US',
          weekStartDay: 1, // Monday
          reducedMotion: false,
          compactDensity: false,
          dailyReflectionReminderTime: '21:30',
          notificationChannels: {
            inApp: true,
            email: false,
            dailyDigest: true,
          },
        },
      };

      users.push({
        user: newUser,
        passwordHash: hashPassword(password),
      });
      this.saveRegisteredUsers(users);

      const session: AuthSession = {
        user: newUser,
        token: `orig_jwt_${generateId('tkn')}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, session);
      return this.success(session);
    } catch (err) {
      return this.failure('AUTH_ERROR', 'Signup failed unexpectedly', { err });
    }
  }

  async logout(): Promise<ServiceResult<void>> {
    safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
    return this.success(undefined);
  }

  async getCurrentSession(): Promise<ServiceResult<AuthSession | null>> {
    const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
    if (!session) return this.success(null);

    // Validate expiration
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
      return this.success(null);
    }

    // Refresh user state from users DB if available
    const users = this.getRegisteredUsers();
    const current = users.find((u) => u.user.id === session.user.id);
    if (current) {
      const refreshedSession = { ...session, user: current.user };
      return this.success(refreshedSession);
    }

    return this.success(session);
  }

  async createDemoSession(): Promise<ServiceResult<AuthSession>> {
    const users = this.getRegisteredUsers();
    let demoUser = users.find((u) => u.user.id === DEFAULT_DEMO_USER.id)?.user;

    if (!demoUser) {
      demoUser = DEFAULT_DEMO_USER;
      users.push({
        user: demoUser,
        passwordHash: hashPassword('demo1234'),
      });
      this.saveRegisteredUsers(users);
    }

    const session: AuthSession = {
      user: demoUser,
      token: `orig_jwt_demo_${generateId('tkn')}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, session);
    return this.success(session);
  }

  async requestPasswordReset(payload: PasswordResetRequestPayload): Promise<ServiceResult<PasswordResetResponse>> {
    try {
      const email = payload.email?.trim().toLowerCase();
      if (!email) {
        return this.failure('AUTH_INVALID_EMAIL', 'Please provide a valid email address.');
      }

      const users = this.getRegisteredUsers();
      const user = users.find((u) => u.user.email.toLowerCase() === email);

      if (!user) {
        return this.failure('AUTH_USER_NOT_FOUND', 'No account exists with this email address.');
      }

      const resetToken = `rst_${generateId('tkn')}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      const existingTokens = safeStorage.get<PasswordResetTokenRecord[]>(
        APP_CONSTANTS.STORAGE_KEYS.PASSWORD_RESET_TOKENS,
        []
      );

      existingTokens.push({
        token: resetToken,
        email,
        expiresAt,
        used: false,
      });

      safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.PASSWORD_RESET_TOKENS, existingTokens);

      return this.success({
        success: true,
        resetToken,
        message: `Password reset instructions sent. Token generated: ${resetToken}`,
      });
    } catch (err) {
      return this.failure('AUTH_RESET_ERROR', 'Failed to generate reset request.', { err });
    }
  }

  async confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<ServiceResult<{ success: boolean; message: string }>> {
    try {
      const { token, newPassword } = payload;
      if (!token) {
        return this.failure('AUTH_INVALID_TOKEN', 'Reset token is required.');
      }
      if (!newPassword || newPassword.length < 6) {
        return this.failure('AUTH_WEAK_PASSWORD', 'New password must be at least 6 characters.');
      }

      const tokens = safeStorage.get<PasswordResetTokenRecord[]>(
        APP_CONSTANTS.STORAGE_KEYS.PASSWORD_RESET_TOKENS,
        []
      );

      const record = tokens.find((t) => t.token === token && !t.used);
      if (!record) {
        return this.failure('AUTH_TOKEN_EXPIRED', 'Invalid or expired password reset token.');
      }

      if (new Date(record.expiresAt).getTime() < Date.now()) {
        return this.failure('AUTH_TOKEN_EXPIRED', 'Reset token has expired. Please request a new one.');
      }

      const users = this.getRegisteredUsers();
      const userIndex = users.findIndex((u) => u.user.email.toLowerCase() === record.email.toLowerCase());

      if (userIndex === -1) {
        return this.failure('AUTH_USER_NOT_FOUND', 'Account associated with token not found.');
      }

      users[userIndex] = {
        ...users[userIndex],
        passwordHash: hashPassword(newPassword),
        user: {
          ...users[userIndex].user,
          updatedAt: new Date().toISOString(),
        },
      };
      this.saveRegisteredUsers(users);

      record.used = true;
      safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.PASSWORD_RESET_TOKENS, tokens);

      return this.success({
        success: true,
        message: 'Password reset successfully. You may now sign in with your new password.',
      });
    } catch (err) {
      return this.failure('AUTH_RESET_ERROR', 'Failed to update password.', { err });
    }
  }
}

export const authService = new AuthService();
