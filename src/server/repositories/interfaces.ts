import {
  UserRecord,
  TaskRecord,
  HabitRecord,
  HabitLogRecord,
  GoalRecord,
  TransactionRecord,
  BudgetRecord,
  ReflectionRecord,
  RelationshipRecord,
  ContactInteractionRecord,
  NoteRecord,
  AIMemoryRecord,
  AuditLogRecord,
  PasswordResetRecord,
  NotificationRecord,
  ScheduledNotificationRecord,
} from '../db';

export interface IUserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByVerificationToken(token: string): Promise<UserRecord | null>;
  create(user: UserRecord): Promise<UserRecord>;
  update(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null>;
  updateProfile(id: string, profileUpdates: Partial<UserRecord['profile']>): Promise<UserRecord | null>;
  updatePreferences(id: string, preferenceUpdates: Partial<UserRecord['preferences']>): Promise<UserRecord | null>;
  delete(id: string): Promise<boolean>;
  seedStarterData(userId: string): Promise<void>;
  purgeAllUserData(userId: string): Promise<void>;
  exportAllUserData(userId: string): Promise<Record<string, any>>;
}

export interface TaskFilterOptions {
  status?: string;
  priority?: string;
  search?: string;
  goalId?: string;
  dueBefore?: string;
  dueAfter?: string;
  tag?: string;
  excludeCanceled?: boolean;
}

export interface ITaskRepository {
  findByUserId(userId: string, filter?: TaskFilterOptions): Promise<TaskRecord[]>;
  findById(id: string, userId?: string): Promise<TaskRecord | null>;
  create(task: TaskRecord): Promise<TaskRecord>;
  update(id: string, userId: string, updates: Partial<TaskRecord>): Promise<TaskRecord | null>;
  updateStatus(id: string, userId: string, status: TaskRecord['status']): Promise<TaskRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  countByUserId(userId: string, filter?: { excludeCanceled?: boolean }): Promise<number>;
}

export interface IHabitRepository {
  findByUserId(userId: string, filter?: { archived?: boolean }): Promise<HabitRecord[]>;
  findById(id: string, userId?: string): Promise<HabitRecord | null>;
  create(habit: HabitRecord): Promise<HabitRecord>;
  update(id: string, userId: string, updates: Partial<HabitRecord>): Promise<HabitRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  countActiveByUserId(userId: string): Promise<number>;
}

export interface HabitLogFilterOptions {
  habitId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  completedOnly?: boolean;
}

export interface IHabitLogRepository {
  findByUserId(userId: string, filter?: HabitLogFilterOptions): Promise<HabitLogRecord[]>;
  findByHabitAndDate(userId: string, habitId: string, date: string): Promise<HabitLogRecord | null>;
  findById(id: string, userId?: string): Promise<HabitLogRecord | null>;
  logHabit(
    userId: string,
    habitId: string,
    data: { date?: string; completed?: boolean; value?: number; notes?: string }
  ): Promise<{ log: HabitLogRecord; habit: HabitRecord } | null>;
  create(log: HabitLogRecord): Promise<HabitLogRecord>;
  update(id: string, userId: string, updates: Partial<HabitLogRecord>): Promise<HabitLogRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  unlogHabit(userId: string, habitId: string, date: string): Promise<boolean>;
}

export interface IGoalRepository {
  findByUserId(userId: string, filter?: { status?: string }): Promise<GoalRecord[]>;
  findById(id: string, userId?: string): Promise<GoalRecord | null>;
  create(goal: GoalRecord): Promise<GoalRecord>;
  update(id: string, userId: string, updates: Partial<GoalRecord>): Promise<GoalRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  countActiveByUserId(userId: string): Promise<number>;
}

export interface TransactionFilterOptions {
  type?: 'income' | 'expense';
  category?: string;
  startDate?: string;
  endDate?: string;
  month?: string; // YYYY-MM
  minAmount?: number;
  maxAmount?: number;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  savingsRatePercentage: number;
  transactionCount: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  byCategory?: Record<string, number>;
}

export interface ITransactionRepository {
  findByUserId(userId: string, filter?: TransactionFilterOptions): Promise<TransactionRecord[]>;
  findById(id: string, userId?: string): Promise<TransactionRecord | null>;
  create(transaction: TransactionRecord): Promise<TransactionRecord>;
  update(id: string, userId: string, updates: Partial<TransactionRecord>): Promise<TransactionRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  getSummary(userId: string): Promise<FinanceSummary>;
}

export interface IBudgetRepository {
  findByUserId(userId: string): Promise<BudgetRecord[]>;
  findById(id: string, userId?: string): Promise<BudgetRecord | null>;
  findByCategory(userId: string, category: string): Promise<BudgetRecord | null>;
  create(budget: BudgetRecord): Promise<BudgetRecord>;
  update(id: string, userId: string, updates: Partial<BudgetRecord>): Promise<BudgetRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface IReflectionRepository {
  findByUserId(userId: string): Promise<ReflectionRecord[]>;
  findByDate(userId: string, date: string): Promise<ReflectionRecord | null>;
  findById(id: string, userId?: string): Promise<ReflectionRecord | null>;
  upsert(
    userId: string,
    date: string,
    data: {
      energyLevel?: number;
      clarityLevel?: number;
      stressLevel?: number;
      mood?: number;
      primaryEmotion?: string;
      journalEntry?: string;
      reflection?: string;
      wins?: string[];
      gratitudes?: string[];
      learnings?: string[];
      tags?: string[];
    }
  ): Promise<ReflectionRecord>;
  create(reflection: ReflectionRecord): Promise<ReflectionRecord>;
  update(id: string, userId: string, updates: Partial<ReflectionRecord>): Promise<ReflectionRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface IRelationshipRepository {
  findByUserId(userId: string): Promise<RelationshipRecord[]>;
  findById(id: string, userId?: string): Promise<RelationshipRecord | null>;
  create(relationship: RelationshipRecord): Promise<RelationshipRecord>;
  update(id: string, userId: string, updates: Partial<RelationshipRecord>): Promise<RelationshipRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface IInteractionRepository {
  findByUserId(userId: string, contactId?: string): Promise<ContactInteractionRecord[]>;
  findById(id: string, userId?: string): Promise<ContactInteractionRecord | null>;
  create(interaction: ContactInteractionRecord): Promise<ContactInteractionRecord>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface NoteFilterOptions {
  folderId?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  tag?: string;
  search?: string;
}

export interface INoteRepository {
  findByUserId(userId: string, filter?: NoteFilterOptions): Promise<NoteRecord[]>;
  findById(id: string, userId?: string): Promise<NoteRecord | null>;
  create(note: NoteRecord): Promise<NoteRecord>;
  update(id: string, userId: string, updates: Partial<NoteRecord>): Promise<NoteRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface IAIMemoryRepository {
  findByUserId(userId: string): Promise<AIMemoryRecord[]>;
  findByKey(userId: string, key: string): Promise<AIMemoryRecord | null>;
  create(memory: AIMemoryRecord): Promise<AIMemoryRecord>;
  update(id: string, userId: string, updates: Partial<AIMemoryRecord>): Promise<AIMemoryRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface IAuditLogRepository {
  findByUserId(userId: string, limit?: number): Promise<AuditLogRecord[]>;
  create(entry: AuditLogRecord): Promise<AuditLogRecord>;
}

export interface IPasswordResetRepository {
  findByToken(token: string): Promise<PasswordResetRecord | null>;
  findActiveByEmail(email: string): Promise<PasswordResetRecord | null>;
  create(record: PasswordResetRecord): Promise<PasswordResetRecord>;
  markUsed(token: string): Promise<boolean>;
}

export interface INotificationRepository {
  findByUserId(userId: string, options?: { isRead?: boolean; limit?: number }): Promise<NotificationRecord[]>;
  countUnreadByUserId(userId: string): Promise<number>;
  findById(id: string, userId: string): Promise<NotificationRecord | null>;
  findByScheduledNotificationId(scheduledNotificationId: string): Promise<NotificationRecord | null>;
  create(notification: NotificationRecord): Promise<NotificationRecord>;
  createMany(notifications: NotificationRecord[]): Promise<NotificationRecord[]>;
  markAsRead(id: string, userId: string): Promise<NotificationRecord | null>;
  markAllAsRead(userId: string): Promise<number>;
  delete(id: string, userId: string): Promise<boolean>;
  deleteAllByUserId(userId: string): Promise<number>;
}

export interface IScheduledNotificationRepository {
  findByUserId(userId: string): Promise<ScheduledNotificationRecord[]>;
  findById(id: string, userId: string): Promise<ScheduledNotificationRecord | null>;
  findDue(targetTimeMs: number): Promise<ScheduledNotificationRecord[]>;
  create(record: ScheduledNotificationRecord): Promise<ScheduledNotificationRecord>;
  update(id: string, userId: string, updates: Partial<ScheduledNotificationRecord>): Promise<ScheduledNotificationRecord | null>;
  delete(id: string, userId: string): Promise<ScheduledNotificationRecord | null>;
}

export interface RepositoryContainer {
  users: IUserRepository;
  tasks: ITaskRepository;
  habits: IHabitRepository;
  habitLogs: IHabitLogRepository;
  goals: IGoalRepository;
  transactions: ITransactionRepository;
  budgets: IBudgetRepository;
  reflections: IReflectionRepository;
  relationships: IRelationshipRepository;
  interactions: IInteractionRepository;
  notes: INoteRepository;
  aiMemories: IAIMemoryRepository;
  auditLogs: IAuditLogRepository;
  passwordResets: IPasswordResetRepository;
  notifications: INotificationRepository;
  scheduledNotifications: IScheduledNotificationRepository;
}
