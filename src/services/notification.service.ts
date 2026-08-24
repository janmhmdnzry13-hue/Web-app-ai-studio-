/**
 * Notification Architecture & Dynamic Rule Engine
 * Generates proactive contextual alerts from tasks, habits, goal deadlines, and relationship cadences.
 * Browser notification permission is ONLY requested upon explicit operator action.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
import { PriorityLevel, ServiceResult } from '../types/common.types';
import { Notification, NotificationRuleSettings, NotificationType } from '../types/notification.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';
import { financeService } from './finance.service';
import { goalService } from './goal.service';
import { getTodayDateString, habitService, isDayExpectedForFrequency } from './habit.service';
import { relationshipService } from './relationship.service';
import { taskService } from './task.service';

const DEFAULT_SETTINGS: NotificationRuleSettings = {
  taskRemindersEnabled: true,
  habitRemindersEnabled: true,
  goalDeadlinesEnabled: true,
  relationshipRemindersEnabled: true,
  budgetAlertsEnabled: true,
  browserNotificationsEnabled: false,
};

export interface CreateNotificationDTO {
  type: NotificationType;
  title: string;
  message: string;
  priority?: PriorityLevel;
  actionUrl?: string;
  entityReference?: {
    type: 'task' | 'habit' | 'goal' | 'relationship' | 'budget' | 'system';
    id: string;
  };
}

export class NotificationService extends BaseService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && typeof providedUserId === 'string' && providedUserId.trim().length > 0) {
      return providedUserId.trim();
    }
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user?.id) {
      return sessionRes.data.user.id;
    }
    return '';
  }

  private getStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.NOTIFICATIONS_PREFIX}${userId}`;
  }

  private getSettingsStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.NOTIFICATION_SETTINGS_PREFIX}${userId}`;
  }

  getNotificationSettings(userId = ''): NotificationRuleSettings {
    if (!userId) return DEFAULT_SETTINGS;
    return safeStorage.get<NotificationRuleSettings>(this.getSettingsStorageKey(userId), DEFAULT_SETTINGS);
  }

  saveNotificationSettings(userId: string, settings: NotificationRuleSettings): void {
    if (!userId) return;
    safeStorage.set(this.getSettingsStorageKey(userId), settings);
  }

  private getStoredNotifications(userId: string): Notification[] {
    if (!userId) return [];
    return safeStorage.get<Notification[]>(this.getStorageKey(userId), []);
  }

  private saveStoredNotifications(userId: string, notifs: Notification[]): void {
    if (!userId) return;
    safeStorage.set(this.getStorageKey(userId), notifs);
  }

  /**
   * Create a single notification directly
   */
  async createNotification(
    userIdOrDto: string | CreateNotificationDTO,
    maybeDto?: CreateNotificationDTO
  ): Promise<ServiceResult<Notification>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as CreateNotificationDTO;

      if (!dto || !dto.title || !dto.message) {
        return this.failure('VALIDATION_ERROR', 'Notification title and message are required.');
      }

      const notifs = this.getStoredNotifications(userId);
      const newNotif: Notification = {
        id: generateId('notif'),
        userId,
        type: dto.type || 'system_alert',
        title: dto.title.trim(),
        message: dto.message.trim(),
        priority: dto.priority || 'medium',
        isRead: false,
        actionUrl: dto.actionUrl,
        entityReference: dto.entityReference,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      notifs.unshift(newNotif);
      this.saveStoredNotifications(userId, notifs.slice(0, 50));

      return this.success(newNotif);
    } catch (err) {
      return this.failure('NOTIF_CREATE_ERROR', 'Failed to create notification', { err });
    }
  }

  /**
   * Request browser notifications explicitly on user action
   */
  async requestBrowserPermission(userId: string): Promise<ServiceResult<'granted' | 'denied' | 'default' | 'unsupported'>> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return this.success('unsupported');
    }

    try {
      const permission = await window.Notification.requestPermission();
      const currentSettings = this.getNotificationSettings(userId);
      this.saveNotificationSettings(userId, {
        ...currentSettings,
        browserNotificationsEnabled: permission === 'granted',
      });
      return this.success(permission as 'granted' | 'denied' | 'default');
    } catch {
      return this.failure('PERMISSION_ERROR', 'Failed to request notification permission.');
    }
  }

  /**
   * Send a system/browser notification if granted and enabled
   */
  sendBrowserNotification(title: string, options?: NotificationOptions): void {
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        new window.Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
      } catch {
        // Silently catch if not allowed in iframe
      }
    }
  }

  /**
   * Evaluates active rules across tasks, habits, goals, relationships, budgets and synchronizes alerts
   */
  async syncAndEvaluateNotifications(providedUserId?: string): Promise<ServiceResult<readonly Notification[]>> {
    try {
      const userId = await this.resolveUserId(providedUserId);
      const settings = this.getNotificationSettings(userId);
      const existing = this.getStoredNotifications(userId);
      const todayStr = getTodayDateString();
      const now = new Date();

      const newAlerts: Notification[] = [];

      // Helper to avoid duplicate alerts
      const hasRecentAlert = (refType: string, refId: string) =>
        existing.some(
          (n) =>
            n.entityReference?.type === refType &&
            n.entityReference?.id === refId &&
            new Date(n.createdAt).toDateString() === now.toDateString()
        );

      // 1. Task Reminders (Due Today or Overdue)
      if (settings.taskRemindersEnabled) {
        const tasksRes = await taskService.getTasks(userId, { status: 'todo' });
        if (tasksRes.success && tasksRes.data?.items) {
          for (const t of tasksRes.data.items) {
            if (t.dueDate) {
              const dueDateStr = t.dueDate.split('T')[0];
              const isOverdue = dueDateStr < todayStr;
              const isDueToday = dueDateStr === todayStr;

              if ((isOverdue || isDueToday) && !hasRecentAlert('task', t.id)) {
                newAlerts.push({
                  id: generateId('notif'),
                  userId,
                  title: isOverdue ? `Overdue Task: ${t.title}` : `Task Due Today: ${t.title}`,
                  message: isOverdue
                    ? `Task was due on ${dueDateStr}. Priority: ${t.priority}.`
                    : `Scheduled for completion today. Priority: ${t.priority}.`,
                  type: 'task_reminder',
                  priority: isOverdue || t.priority === 'urgent' ? 'urgent' : 'high',
                  isRead: false,
                  actionUrl: '/app/tasks',
                  entityReference: { type: 'task', id: t.id },
                  createdAt: now.toISOString(),
                  updatedAt: now.toISOString(),
                });
              }
            }
          }
        }
      }

      // 2. Habit Reminders (Pending today)
      if (settings.habitRemindersEnabled) {
        const [habitsRes, logsRes] = await Promise.all([
          habitService.getHabits(userId),
          habitService.getHabitLogs(userId),
        ]);

        if (habitsRes.success && habitsRes.data && logsRes.success && logsRes.data) {
          const expectedToday = habitsRes.data.filter(
            (h) => !h.isArchived && isDayExpectedForFrequency(todayStr, h.frequency, h.customDaysOfWeek)
          );

          for (const h of expectedToday) {
            const isCompleted = logsRes.data.some((l) => l.habitId === h.id && l.date === todayStr && l.targetMet);
            if (!isCompleted && !hasRecentAlert('habit', h.id)) {
              newAlerts.push({
                id: generateId('notif'),
                userId,
                title: `Daily Cadence: ${h.name}`,
                message: `Maintain your ${h.streak.currentStreak}-day streak. Target: ${h.targetUnits} ${h.unitLabel || 'session'}.`,
                type: 'habit_reminder',
                priority: 'medium',
                isRead: false,
                actionUrl: '/app/habits',
                entityReference: { type: 'habit', id: h.id },
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              });
            }
          }
        }
      }

      // 3. Goal Deadlines (Approaching within 7 days)
      if (settings.goalDeadlinesEnabled) {
        const goalsRes = await goalService.getGoals(userId);
        if (goalsRes.success && goalsRes.data) {
          const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          for (const g of goalsRes.data) {
            if (g.status === 'active' && g.targetDate <= sevenDaysAhead && !hasRecentAlert('goal', g.id)) {
              newAlerts.push({
                id: generateId('notif'),
                userId,
                title: `Horizon Deadline: ${g.title}`,
                message: `Target milestone date is ${g.targetDate}. Current progress: ${g.progressPercentage}%.`,
                type: 'goal_deadline',
                priority: 'high',
                isRead: false,
                actionUrl: '/app/goals',
                entityReference: { type: 'goal', id: g.id },
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              });
            }
          }
        }
      }

      // 4. Relationship Cadence Reminders
      if (settings.relationshipRemindersEnabled) {
        const relsRes = await relationshipService.getRelationships(userId);
        if (relsRes.success && relsRes.data) {
          for (const r of relsRes.data) {
            if (r.nextReminder && r.nextReminder <= todayStr && !hasRecentAlert('relationship', r.id)) {
              newAlerts.push({
                id: generateId('notif'),
                userId,
                title: `Reach Out: ${r.name}`,
                message: `Relational check-in due (${r.relationshipType.replace('_', ' ')}). Cadence: every ${r.cadenceDays || 14} days.`,
                type: 'relationship_reminder',
                priority: 'medium',
                isRead: false,
                actionUrl: '/app/relationships',
                entityReference: { type: 'relationship', id: r.id },
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              });
            }
          }
        }
      }

      // 5. Budget Threshold Alerts (Spend > threshold)
      if (settings.budgetAlertsEnabled) {
        const budgetProgressRes = await financeService.getBudgets(userId);
        if (budgetProgressRes.success && budgetProgressRes.data) {
          for (const bp of budgetProgressRes.data) {
            if (bp.percentageUsed >= (bp.alertThresholdPercentage || 80) && !hasRecentAlert('budget', bp.id)) {
              newAlerts.push({
                id: generateId('notif'),
                userId,
                title: bp.isOverBudget ? `Budget Exceeded: ${bp.category}` : `Budget Alert: ${bp.category}`,
                message: bp.isOverBudget
                  ? `Spent $${bp.spent.toFixed(2)} of $${bp.amount.toFixed(2)} budget (${bp.percentageUsed}%).`
                  : `Spent $${bp.spent.toFixed(2)} (${bp.percentageUsed}% of $${bp.amount.toFixed(2)} limit).`,
                type: 'budget_alert',
                priority: bp.isOverBudget ? 'urgent' : 'high',
                isRead: false,
                actionUrl: '/app/finances',
                entityReference: { type: 'budget', id: bp.id },
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              });
            }
          }
        }
      }

      // Combine existing with newly detected alerts
      const updatedList = [...newAlerts, ...existing];
      // Keep maximum 50 most recent notifications
      const pruned = updatedList.slice(0, 50);
      this.saveStoredNotifications(userId, pruned);

      return this.success(pruned);
    } catch (err) {
      return this.failure('NOTIF_EVAL_ERROR', 'Failed to evaluate notifications.', { err });
    }
  }

  async getNotifications(providedUserId?: string): Promise<ServiceResult<readonly Notification[]>> {
    try {
      const userId = await this.resolveUserId(providedUserId);
      const notifs = this.getStoredNotifications(userId);
      return this.success(notifs);
    } catch (err) {
      return this.failure('NOTIF_FETCH_ERROR', 'Failed to get notifications.', { err });
    }
  }

  async markAsRead(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const notifId = maybeId || userIdOrId;

      const notifs = this.getStoredNotifications(userId);
      const updated = notifs.map((n) =>
        n.id === notifId ? { ...n, isRead: true, readAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : n
      );

      this.saveStoredNotifications(userId, updated);
      return this.success(undefined);
    } catch (err) {
      return this.failure('NOTIF_UPDATE_ERROR', 'Failed to mark notification as read.', { err });
    }
  }

  async markAllAsRead(providedUserId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = await this.resolveUserId(providedUserId);
      const notifs = this.getStoredNotifications(userId);
      const now = new Date().toISOString();
      const updated = notifs.map((n) => ({ ...n, isRead: true, readAt: now, updatedAt: now }));

      this.saveStoredNotifications(userId, updated);
      return this.success(undefined);
    } catch (err) {
      return this.failure('NOTIF_UPDATE_ERROR', 'Failed to mark all notifications as read.', { err });
    }
  }

  async deleteNotification(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const notifId = maybeId || userIdOrId;

      const notifs = this.getStoredNotifications(userId);
      const filtered = notifs.filter((n) => n.id !== notifId);

      this.saveStoredNotifications(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('NOTIF_DELETE_ERROR', 'Failed to delete notification.', { err });
    }
  }

  async clearAll(providedUserId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = await this.resolveUserId(providedUserId);
      this.saveStoredNotifications(userId, []);
      return this.success(undefined);
    } catch (err) {
      return this.failure('NOTIF_CLEAR_ERROR', 'Failed to clear notifications.', { err });
    }
  }

  async getUnreadCount(providedUserId?: string): Promise<ServiceResult<number>> {
    try {
      const userId = await this.resolveUserId(providedUserId);
      const notifs = this.getStoredNotifications(userId);
      const count = notifs.filter((n) => !n.isRead).length;
      return this.success(count);
    } catch (err) {
      return this.failure('NOTIF_COUNT_ERROR', 'Failed to get unread notification count.', { err });
    }
  }
}

export const notificationService = new NotificationService();
