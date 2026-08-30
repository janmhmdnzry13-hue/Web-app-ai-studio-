export * from './interfaces';
export * from './json';
export * from './postgres';

import {
  RepositoryContainer,
  IUserRepository,
  ITaskRepository,
  IHabitRepository,
  IHabitLogRepository,
  IGoalRepository,
  ITransactionRepository,
  IBudgetRepository,
  IReflectionRepository,
  IRelationshipRepository,
  IInteractionRepository,
  INoteRepository,
  IAIMemoryRepository,
  IAuditLogRepository,
  IPasswordResetRepository,
  INotificationRepository,
  IScheduledNotificationRepository,
} from './interfaces';

import { isPostgresConfigured, isProductionEnvironment } from '../db/postgres';
import { createPostgresRepositoryContainer } from './postgres';
import {
  JsonUserRepository,
  JsonTaskRepository,
  JsonHabitRepository,
  JsonHabitLogRepository,
  JsonGoalRepository,
  JsonTransactionRepository,
  JsonBudgetRepository,
  JsonReflectionRepository,
  JsonRelationshipRepository,
  JsonInteractionRepository,
  JsonNoteRepository,
  JsonAIMemoryRepository,
  JsonAuditLogRepository,
  JsonPasswordResetRepository,
  JsonNotificationRepository,
  JsonScheduledNotificationRepository,
} from './json';

export type StorageEngineType = 'postgres' | 'json';

let storageEngineOverride: StorageEngineType | null = null;
let customRepositoryContainerOverride: RepositoryContainer | null = null;

let cachedPostgresContainer: RepositoryContainer | null = null;
let cachedJsonContainer: RepositoryContainer | null = null;

export function setStorageEngineForTesting(engine: StorageEngineType | null): void {
  storageEngineOverride = engine;
}

export function setRepositoriesForTesting(container: RepositoryContainer | null): void {
  customRepositoryContainerOverride = container;
}

export function resetRepositories(): void {
  storageEngineOverride = null;
  customRepositoryContainerOverride = null;
  cachedPostgresContainer = null;
  cachedJsonContainer = null;
}

export function determineActiveEngine(): StorageEngineType {
  if (storageEngineOverride) {
    return storageEngineOverride;
  }
  if (isProductionEnvironment()) {
    // Production MUST use PostgreSQL
    return 'postgres';
  }
  if (isPostgresConfigured()) {
    return 'postgres';
  }
  // Development/test local fallback
  return 'json';
}

function getJsonContainer(): RepositoryContainer {
  if (!cachedJsonContainer) {
    const user = new JsonUserRepository();
    const task = new JsonTaskRepository();
    const habit = new JsonHabitRepository();
    const habitLog = new JsonHabitLogRepository();
    const goal = new JsonGoalRepository();
    const transaction = new JsonTransactionRepository();
    const budget = new JsonBudgetRepository();
    const reflection = new JsonReflectionRepository();
    const relationship = new JsonRelationshipRepository();
    const interaction = new JsonInteractionRepository();
    const note = new JsonNoteRepository();
    const aiMemory = new JsonAIMemoryRepository();
    const auditLog = new JsonAuditLogRepository();
    const passwordReset = new JsonPasswordResetRepository();
    const notification = new JsonNotificationRepository();
    const scheduledNotification = new JsonScheduledNotificationRepository();

    cachedJsonContainer = {
      users: user,
      tasks: task,
      habits: habit,
      habitLogs: habitLog,
      goals: goal,
      transactions: transaction,
      budgets: budget,
      reflections: reflection,
      relationships: relationship,
      interactions: interaction,
      notes: note,
      aiMemories: aiMemory,
      auditLogs: auditLog,
      passwordResets: passwordReset,
      notifications: notification,
      scheduledNotifications: scheduledNotification,
    };
  }
  return cachedJsonContainer;
}

function getPostgresContainer(): RepositoryContainer {
  if (!cachedPostgresContainer) {
    const pg = createPostgresRepositoryContainer();
    cachedPostgresContainer = {
      users: pg.user,
      tasks: pg.task,
      habits: pg.habit,
      habitLogs: pg.habitLog,
      goals: pg.goal,
      transactions: pg.transaction,
      budgets: pg.budget,
      reflections: pg.reflection,
      relationships: pg.relationship,
      interactions: pg.interaction,
      notes: pg.note,
      aiMemories: pg.aiMemory,
      auditLogs: pg.auditLog,
      passwordResets: pg.passwordReset,
      notifications: pg.notification,
      scheduledNotifications: pg.scheduledNotification,
    };
  }
  return cachedPostgresContainer;
}

export function getActiveRepositories(): RepositoryContainer {
  if (customRepositoryContainerOverride) {
    return customRepositoryContainerOverride;
  }

  const engine = determineActiveEngine();
  if (engine === 'postgres') {
    if (isProductionEnvironment() && !isPostgresConfigured()) {
      throw new Error(
        'CRITICAL_DATABASE_ERROR: PostgreSQL connection configuration (DATABASE_URL) is required in production environment. Silent fallback to JSON storage is strictly prohibited.'
      );
    }
    return getPostgresContainer();
  }

  return getJsonContainer();
}

/**
 * Creates a dynamic proxy delegating all method calls to the currently active repository instance.
 */
function createRepositoryProxy<T extends object>(key: keyof RepositoryContainer): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const active = getActiveRepositories()[key] as any;
      const val = active[prop];
      if (typeof val === 'function') {
        return (...args: any[]) => val.apply(active, args);
      }
      return Reflect.get(active, prop, receiver);
    },
  });
}

// Proxied singleton repository exports matching original signatures
export const userRepository: IUserRepository = createRepositoryProxy<IUserRepository>('users');
export const taskRepository: ITaskRepository = createRepositoryProxy<ITaskRepository>('tasks');
export const habitRepository: IHabitRepository = createRepositoryProxy<IHabitRepository>('habits');
export const habitLogRepository: IHabitLogRepository = createRepositoryProxy<IHabitLogRepository>('habitLogs');
export const goalRepository: IGoalRepository = createRepositoryProxy<IGoalRepository>('goals');
export const transactionRepository: ITransactionRepository = createRepositoryProxy<ITransactionRepository>('transactions');
export const budgetRepository: IBudgetRepository = createRepositoryProxy<IBudgetRepository>('budgets');
export const reflectionRepository: IReflectionRepository = createRepositoryProxy<IReflectionRepository>('reflections');
export const relationshipRepository: IRelationshipRepository = createRepositoryProxy<IRelationshipRepository>('relationships');
export const interactionRepository: IInteractionRepository = createRepositoryProxy<IInteractionRepository>('interactions');
export const noteRepository: INoteRepository = createRepositoryProxy<INoteRepository>('notes');
export const aiMemoryRepository: IAIMemoryRepository = createRepositoryProxy<IAIMemoryRepository>('aiMemories');
export const auditLogRepository: IAuditLogRepository = createRepositoryProxy<IAuditLogRepository>('auditLogs');
export const passwordResetRepository: IPasswordResetRepository = createRepositoryProxy<IPasswordResetRepository>('passwordResets');
export const notificationRepository: INotificationRepository = createRepositoryProxy<INotificationRepository>('notifications');
export const scheduledNotificationRepository: IScheduledNotificationRepository =
  createRepositoryProxy<IScheduledNotificationRepository>('scheduledNotifications');

export const repositories: RepositoryContainer = {
  users: userRepository,
  tasks: taskRepository,
  habits: habitRepository,
  habitLogs: habitLogRepository,
  goals: goalRepository,
  transactions: transactionRepository,
  budgets: budgetRepository,
  reflections: reflectionRepository,
  relationships: relationshipRepository,
  interactions: interactionRepository,
  notes: noteRepository,
  aiMemories: aiMemoryRepository,
  auditLogs: auditLogRepository,
  passwordResets: passwordResetRepository,
  notifications: notificationRepository,
  scheduledNotifications: scheduledNotificationRepository,
};

export default repositories;
