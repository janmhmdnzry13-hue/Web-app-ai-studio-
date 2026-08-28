/**
 * User & Profile Domain Models
 */
import { BaseEntity, EntityId, ISODateString, ThemePreference } from './common.types';

export type UserRole = 'member' | 'admin' | 'guest';

export type AuthStatus =
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'NETWORK_ERROR';

export interface UserPreferences {
  readonly theme: ThemePreference;
  readonly timezone: string;
  readonly locale: string;
  readonly weekStartDay: 0 | 1 | 6; // Sunday = 0, Monday = 1, Saturday = 6
  readonly reducedMotion: boolean;
  readonly compactDensity: boolean;
  readonly dailyReflectionReminderTime: string | null; // e.g. "21:00"
  readonly notificationChannels: {
    readonly inApp: boolean;
    readonly email: boolean;
    readonly dailyDigest: boolean;
  };
}

export interface Profile {
  readonly displayName: string;
  readonly headline?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly primaryLifeFocus?: string;
}

export interface User extends BaseEntity {
  readonly email: string;
  readonly role: UserRole;
  readonly profile: Profile;
  readonly preferences: UserPreferences;
  readonly emailVerified: boolean;
  readonly lastLoginAt: ISODateString | null;
}

export interface AuthSession {
  readonly user: User;
  readonly token: string;
  readonly expiresAt: ISODateString;
}

export interface LoginCredentials {
  readonly email: string;
  readonly password?: string;
}

export interface SignupPayload {
  readonly email: string;
  readonly displayName: string;
  readonly password?: string;
}

export interface PasswordResetRequestPayload {
  readonly email: string;
}

export interface PasswordResetConfirmPayload {
  readonly token: string;
  readonly newPassword: string;
}

export interface PasswordResetResponse {
  readonly success: boolean;
  readonly message: string;
}

export type AuthState =
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'NETWORK_ERROR';

export interface SessionRestorationResult {
  readonly status: AuthState;
  readonly session: AuthSession | null;
  readonly error?: string;
}
