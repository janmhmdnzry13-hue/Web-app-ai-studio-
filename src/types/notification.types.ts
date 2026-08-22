/**
 * Notification & In-App Alert Models
 */
import { EntityId, ISODateString, PriorityLevel, UserScopedEntity } from './common.types';

export type NotificationType =
  | 'task_reminder'
  | 'habit_reminder'
  | 'goal_deadline'
  | 'relationship_reminder'
  | 'budget_alert'
  | 'system_update'
  | 'system_alert';

export interface Notification extends UserScopedEntity {
  readonly title: string;
  readonly message: string;
  readonly type: NotificationType;
  readonly priority: PriorityLevel;
  readonly isRead: boolean;
  readonly actionUrl?: string;
  readonly entityReference?: {
    readonly type: 'task' | 'habit' | 'goal' | 'relationship' | 'budget' | 'system';
    readonly id: EntityId;
  };
  readonly readAt?: ISODateString;
}

export interface NotificationRuleSettings {
  readonly taskRemindersEnabled: boolean;
  readonly habitRemindersEnabled: boolean;
  readonly goalDeadlinesEnabled: boolean;
  readonly relationshipRemindersEnabled: boolean;
  readonly budgetAlertsEnabled: boolean;
  readonly browserNotificationsEnabled: boolean;
}
