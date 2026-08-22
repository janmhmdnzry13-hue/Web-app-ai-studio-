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

  async exportFullUserData(userId: string): Promise<ServiceResult<UserExportArchive>> {
    try {
      if (!userId) return this.failure('INVALID_USER', 'User ID is required for export.');

      const users = this.getRegisteredUsers();
      const account = users.find((u) => u.user.id === userId);
      const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
      const fallbackUser: User = {
        id: userId,
        email: `${userId}@origin-os.internal`,
        role: 'member',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        profile: {
          displayName: 'ORIGIN Operator',
          headline: 'Self-Sovereign Identity',
          bio: '',
        },
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

      const user = account?.user || (session?.user.id === userId ? session.user : fallbackUser);

      // Collect all user-isolated module stores
      const tasks = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.TASKS_PREFIX}${userId}`, []);
      const goals = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.GOALS_PREFIX}${userId}`, []);
      const habits = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.HABITS_PREFIX}${userId}`, []);
      const habitLogs = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.HABIT_LOGS_PREFIX}${userId}`, []);
      const transactions = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.TRANSACTIONS_PREFIX}${userId}`, []);
      const budgets = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.BUDGETS_PREFIX}${userId}`, []);
      const reflections = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.REFLECTIONS_PREFIX}${userId}`, []);
      const relationships = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.RELATIONSHIPS_PREFIX}${userId}`, []);
      const notes = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.NOTES_PREFIX}${userId}`, []);
      const noteFolders = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.NOTE_FOLDERS_PREFIX}${userId}`, []);
      const notifications = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.NOTIFICATIONS_PREFIX}${userId}`, []);
      const aiMemories = safeStorage.get<unknown[]>(`origin_ai_memories_${userId}`, []);
      const aiConversations = safeStorage.get<unknown[]>(`origin_ai_conversations_${userId}`, []);
      const insights = safeStorage.get<unknown[]>(`${APP_CONSTANTS.STORAGE_KEYS.INSIGHTS_PREFIX}${userId}`, []);

      const archive: UserExportArchive = {
        version: APP_CONSTANTS.VERSION,
        exportedAt: new Date().toISOString(),
        user,
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
          noteFolders,
          notifications,
          aiMemories,
          aiConversations,
          insights,
        },
      };

      return this.success(archive);
    } catch (err) {
      return this.failure('EXPORT_FAILED', 'Failed to generate user data export archive.', { err });
    }
  }

  async deleteAccount(userId: string): Promise<ServiceResult<boolean>> {
    try {
      if (!userId) return this.failure('INVALID_USER', 'User ID is required.');

      // 1. Remove all isolated user stores
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.TASKS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.GOALS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.HABITS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.HABIT_LOGS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.TRANSACTIONS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.BUDGETS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.REFLECTIONS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.RELATIONSHIPS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.NOTES_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.NOTE_FOLDERS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.NOTIFICATIONS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.NOTIFICATION_SETTINGS_PREFIX}${userId}`);
      safeStorage.remove(`${APP_CONSTANTS.STORAGE_KEYS.INSIGHTS_PREFIX}${userId}`);
      safeStorage.remove(`origin_ai_memories_${userId}`);
      safeStorage.remove(`origin_ai_conversations_${userId}`);

      // 2. Remove user from registered users DB
      const users = this.getRegisteredUsers();
      const filteredUsers = users.filter((u) => u.user.id !== userId);
      this.saveRegisteredUsers(filteredUsers);

      // 3. Clear active session if matching
      const session = safeStorage.get<AuthSession | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
      if (session && session.user.id === userId) {
        safeStorage.remove(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION);
      }

      return this.success(true);
    } catch (err) {
      return this.failure('DELETE_FAILED', 'Failed to delete account and user records.', { err });
    }
  }
}

export const userService = new UserService();
