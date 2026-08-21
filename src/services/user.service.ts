/**
 * User Service Contract & Implementation
 * Manages user profile updates, system preferences, avatar customization, and session persistence.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { ServiceResult } from '../types/common.types';
import { AuthSession, Profile, User, UserPreferences } from '../types/user.types';
import { authService, StoredUserAccount } from './auth.service';
import { BaseService } from './base.service';

export interface IUserService {
  getUserProfile(userId: string): Promise<ServiceResult<Profile>>;
  updateProfile(userId: string, updates: Partial<Profile>): Promise<ServiceResult<User>>;
  updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<ServiceResult<UserPreferences>>;
}

export class UserService extends BaseService implements IUserService {
  private getRegisteredUsers(): StoredUserAccount[] {
    return safeStorage.get<StoredUserAccount[]>(APP_CONSTANTS.STORAGE_KEYS.USERS_DB, []);
  }

  private saveRegisteredUsers(users: StoredUserAccount[]): void {
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USERS_DB, users);
  }

  async getUserProfile(userId: string): Promise<ServiceResult<Profile>> {
    const users = this.getRegisteredUsers();
    const account = users.find((u) => u.user.id === userId);
    if (account) {
      return this.success(account.user.profile);
    }

    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user && sessionRes.data.user.id === userId) {
      return this.success(sessionRes.data.user.profile);
    }

    return this.failure('USER_NOT_FOUND', 'Active user profile not found.');
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<ServiceResult<User>> {
    try {
      const users = this.getRegisteredUsers();
      const accountIndex = users.findIndex((u) => u.user.id === userId);

      const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
      const currentUser = accountIndex >= 0 ? users[accountIndex].user : session?.user;

      if (!currentUser) {
        return this.failure('USER_NOT_FOUND', 'Target user was not found.');
      }

      const updatedUser: User = {
        ...currentUser,
        profile: {
          ...currentUser.profile,
          ...updates,
        },
        updatedAt: new Date().toISOString(),
      };

      if (accountIndex >= 0) {
        users[accountIndex] = {
          ...users[accountIndex],
          user: updatedUser,
        };
        this.saveRegisteredUsers(users);
      }

      if (session && session.user.id === userId) {
        const updatedSession: AuthSession = {
          ...session,
          user: updatedUser,
        };
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, updatedSession);
      }

      return this.success(updatedUser);
    } catch (err) {
      return this.failure('USER_UPDATE_FAILED', 'Failed to update profile.', { err });
    }
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<ServiceResult<UserPreferences>> {
    try {
      const users = this.getRegisteredUsers();
      const accountIndex = users.findIndex((u) => u.user.id === userId);

      const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
      const currentUser = accountIndex >= 0 ? users[accountIndex].user : session?.user;

      if (!currentUser) {
        return this.failure('USER_NOT_FOUND', 'Target user was not found.');
      }

      const currentPrefs = currentUser.preferences;
      const updatedPrefs: UserPreferences = {
        ...currentPrefs,
        ...preferences,
        notificationChannels: {
          ...currentPrefs.notificationChannels,
          ...(preferences.notificationChannels || {}),
        },
      };

      const updatedUser: User = {
        ...currentUser,
        preferences: updatedPrefs,
        updatedAt: new Date().toISOString(),
      };

      if (accountIndex >= 0) {
        users[accountIndex] = {
          ...users[accountIndex],
          user: updatedUser,
        };
        this.saveRegisteredUsers(users);
      }

      if (session && session.user.id === userId) {
        const updatedSession: AuthSession = {
          ...session,
          user: updatedUser,
        };
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, updatedSession);
      }

      return this.success(updatedPrefs);
    } catch (err) {
      return this.failure('USER_PREFS_FAILED', 'Failed to update user preferences.', { err });
    }
  }
}

export const userService = new UserService();
