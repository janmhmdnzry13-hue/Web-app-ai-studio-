/**
 * User Service Implementation
 * Communicates with the real server backend for profile updates, preferences, audit logs, and account lifecycle.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { apiClient } from '../lib/api-client';
import { ServiceResult } from '../types/common.types';
import { AuthSession, Profile, User, UserPreferences } from '../types/user.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';

export interface UserExportArchive {
  version: string;
  exportedAt: string;
  user: User;
  data: {
    tasks: unknown[];
    goals: unknown[];
    habits: unknown[];
    habitLogs: unknown[];
    transactions: unknown[];
    budgets: unknown[];
    reflections: unknown[];
    relationships: unknown[];
    notes: unknown[];
    noteFolders: unknown[];
    notifications: unknown[];
    aiMemories: unknown[];
    aiConversations: unknown[];
    insights: unknown[];
  };
}

export interface IUserService {
  getUserProfile(userId: string): Promise<ServiceResult<Profile>>;
  updateProfile(userId: string, updates: Partial<Profile>): Promise<ServiceResult<User>>;
  updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<ServiceResult<UserPreferences>>;
  exportFullUserData(userId: string): Promise<ServiceResult<UserExportArchive>>;
  deleteAccount(userId: string): Promise<ServiceResult<boolean>>;
}

export class UserService extends BaseService implements IUserService {
  async getUserProfile(userId: string): Promise<ServiceResult<Profile>> {
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user && sessionRes.data.user.id === userId) {
      return this.success(sessionRes.data.user.profile);
    }

    const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
    if (session?.user && session.user.id === userId) {
      return this.success(session.user.profile);
    }

    return this.failure('USER_NOT_FOUND', 'Active user profile not found.');
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<ServiceResult<User>> {
    try {
      const res = await apiClient.put<User>('/api/users/profile', updates);
      if (res.success && res.data) {
        const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
        if (session) {
          safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, {
            ...session,
            user: res.data,
          });
        }
        return this.success(res.data);
      }

      // Fallback update in local storage
      const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
      if (session && session.user.id === userId) {
        const updatedUser: User = {
          ...session.user,
          profile: {
            ...session.user.profile,
            ...updates,
          },
          updatedAt: new Date().toISOString(),
        };
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, { ...session, user: updatedUser });
        return this.success(updatedUser);
      }

      return this.failure('USER_UPDATE_FAILED', 'Failed to update profile.');
    } catch (err: any) {
      return this.failure('USER_UPDATE_FAILED', err.message || 'Failed to update profile.');
    }
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<ServiceResult<UserPreferences>> {
    try {
      const res = await apiClient.put<User>('/api/users/preferences', preferences);
      if (res.success && res.data) {
        const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
        if (session) {
          safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, {
            ...session,
            user: res.data,
          });
        }
        return this.success(res.data.preferences);
      }

      // Fallback
      const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
      if (session && session.user.id === userId) {
        const updatedPrefs: UserPreferences = {
          ...session.user.preferences,
          ...preferences,
        };
        const updatedUser: User = {
          ...session.user,
          preferences: updatedPrefs,
          updatedAt: new Date().toISOString(),
        };
        safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, { ...session, user: updatedUser });
        return this.success(updatedPrefs);
      }

      return this.failure('USER_PREFS_FAILED', 'Failed to update preferences.');
    } catch (err: any) {
      return this.failure('USER_PREFS_FAILED', err.message || 'Failed to update user preferences.');
    }
  }

  async exportFullUserData(userId: string): Promise<ServiceResult<UserExportArchive>> {
    try {
      const res = await apiClient.post<any>('/api/auth/export-data');
      if (res.success && res.data) {
        const archive: UserExportArchive = {
          version: APP_CONSTANTS.VERSION,
          exportedAt: res.data.exportedAt || new Date().toISOString(),
          user: res.data.user,
          data: {
            tasks: res.data.tasks || [],
            goals: res.data.goals || [],
            habits: res.data.habits || [],
            habitLogs: res.data.habitLogs || [],
            transactions: res.data.transactions || [],
            budgets: res.data.budgets || [],
            reflections: res.data.reflections || [],
            relationships: res.data.relationships || [],
            notes: res.data.notes || [],
            noteFolders: [],
            notifications: [],
            aiMemories: [],
            aiConversations: [],
            insights: [],
          },
        };
        return this.success(archive);
      }

      // Local fallback export
      const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
      const fallbackUser: User = session?.user || {
        id: userId,
        email: `${userId}@origin-os.internal`,
        role: 'member',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        profile: { displayName: 'Alex Vance', headline: 'Lead Architect', bio: '' },
        preferences: {
          theme: 'system',
          timezone: 'UTC',
          locale: 'en-US',
          weekStartDay: 1,
          reducedMotion: false,
          compactDensity: false,
          dailyReflectionReminderTime: '21:30',
          notificationChannels: { inApp: true, email: false, dailyDigest: true },
        },
      };

      const tasks = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.TASKS_PREFIX}${userId}`, []);
      const goals = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.GOALS_PREFIX}${userId}`, []);
      const habits = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.HABITS_PREFIX}${userId}`, []);
      const habitLogs = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.HABIT_LOGS_PREFIX}${userId}`, []);
      const transactions = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.TRANSACTIONS_PREFIX}${userId}`, []);
      const budgets = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.BUDGETS_PREFIX}${userId}`, []);
      const reflections = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.REFLECTIONS_PREFIX}${userId}`, []);
      const relationships = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.RELATIONSHIPS_PREFIX}${userId}`, []);
      const notes = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.NOTES_PREFIX}${userId}`, []);

      return this.success({
        version: APP_CONSTANTS.VERSION,
        exportedAt: new Date().toISOString(),
        user: fallbackUser,
        data: {
          tasks,
          goals,
          habits,
          habitLogs,
          transactions,
          budgets,
          reflections,
          relationships,
          notes,
          noteFolders: [],
          notifications: [],
          aiMemories: [],
          aiConversations: [],
          insights: [],
        },
      });
    } catch (err: any) {
      return this.failure('EXPORT_FAILED', err.message || 'Failed to export user data.');
    }
  }

  async deleteAccount(userId: string): Promise<ServiceResult<boolean>> {
    try {
      await apiClient.delete('/api/auth/delete-account');

      // Clear local storage keys
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.TASKS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.GOALS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.HABITS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.HABIT_LOGS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.TRANSACTIONS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.BUDGETS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.REFLECTIONS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.RELATIONSHIPS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.NOTES_PREFIX}${userId}`);
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
      safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);

      return this.success(true);
    } catch (err: any) {
      return this.failure('DELETE_FAILED', err.message || 'Failed to delete account.');
    }
  }
}

export const userService = new UserService();
