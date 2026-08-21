/**
 * Notification & Alert Domain Models
 */
import { EntityId, ISODateString, PriorityLevel, UserScopedEntity } from './common.types';

export type NotificationType =
  | 'habit_reminder'
  | 'task_due'
  | 'reflection_prompt'
  | 'relationship_cadence'
  | 'budget_threshold'
  | 'ai_insight_generated'
  | 'system_update';

export interface Notification extends UserScopedEntity {
  readonly title: string;
  readonly message: string;
  readonly type: NotificationType;
  readonly priority: PriorityLevel;
  readonly isRead: boolean;
  readonly actionUrl?: string;
  readonly entityReference?: {
    readonly type: string;
    readonly id: EntityId;
  };
  readonly readAt?: ISODateString;
}
