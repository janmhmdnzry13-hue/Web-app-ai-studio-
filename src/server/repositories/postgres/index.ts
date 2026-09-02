export * from './mappers';
export * from './user.repository';
export * from './task.repository';
export * from './habit.repository';
export * from './habit-log.repository';
export * from './goal.repository';
export * from './transaction.repository';
export * from './budget.repository';
export * from './reflection.repository';
export * from './relationship.repository';
export * from './interaction.repository';
export * from './note.repository';
export * from './ai-memory.repository';
export * from './audit-log.repository';
export * from './password-reset.repository';
export * from './notification.repository';
export * from './scheduled-notification.repository';

import { RepositoryContainer } from '../interfaces';
import { PostgresUserRepository } from './user.repository';
import { PostgresTaskRepository } from './task.repository';
import { PostgresHabitRepository } from './habit.repository';
import { PostgresHabitLogRepository } from './habit-log.repository';
import { PostgresGoalRepository } from './goal.repository';
import { PostgresTransactionRepository } from './transaction.repository';
import { PostgresBudgetRepository } from './budget.repository';
import { PostgresReflectionRepository } from './reflection.repository';
import { PostgresRelationshipRepository } from './relationship.repository';
import { PostgresInteractionRepository } from './interaction.repository';
import { PostgresNoteRepository } from './note.repository';
import { PostgresAIMemoryRepository } from './ai-memory.repository';
import { PostgresAuditLogRepository } from './audit-log.repository';
import { PostgresPasswordResetRepository } from './password-reset.repository';
import { PostgresNotificationRepository } from './notification.repository';
import { PostgresScheduledNotificationRepository } from './scheduled-notification.repository';

export function createPostgresRepositoryContainer(): RepositoryContainer {
  return {
    users: new PostgresUserRepository(),
    tasks: new PostgresTaskRepository(),
    habits: new PostgresHabitRepository(),
    habitLogs: new PostgresHabitLogRepository(),
    goals: new PostgresGoalRepository(),
    transactions: new PostgresTransactionRepository(),
    budgets: new PostgresBudgetRepository(),
    reflections: new PostgresReflectionRepository(),
    relationships: new PostgresRelationshipRepository(),
    interactions: new PostgresInteractionRepository(),
    notes: new PostgresNoteRepository(),
    aiMemories: new PostgresAIMemoryRepository(),
    auditLogs: new PostgresAuditLogRepository(),
    passwordResets: new PostgresPasswordResetRepository(),
    notifications: new PostgresNotificationRepository(),
    scheduledNotifications: new PostgresScheduledNotificationRepository(),
  };
}
