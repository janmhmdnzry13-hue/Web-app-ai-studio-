/**
 * ORIGIN Relational Database Schema Definition (TypeScript / Relational Model)
 *
 * Source of Truth: Existing TypeScript Models, JSON Storage Schema, and Repository Layer.
 * Defines tables, columns, primary keys, foreign keys, nullability, defaults, unique constraints, and indexes.
 */

export interface ColumnDefinition {
  name: string;
  type: string;
  isPrimary?: boolean;
  isNullable?: boolean;
  defaultValue?: string | number | boolean | null;
  foreignKey?: {
    table: string;
    column: string;
    onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
  check?: string;
  isUnique?: boolean;
  description?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  isUnique?: boolean;
  whereClause?: string;
}

export interface TableDefinition {
  name: string;
  description: string;
  primaryKey: string[];
  columns: Record<string, ColumnDefinition>;
  foreignKeys: Array<{
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
    onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  }>;
  uniqueConstraints: Array<{
    name: string;
    columns: string[];
  }>;
  indexes: IndexDefinition[];
}

export const relationalSchemaCatalog: Record<string, TableDefinition> = {
  users: {
    name: 'users',
    description: 'Core user identity, authentication, profile metadata, preferences, and subscription tier.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      email: { name: 'email', type: 'VARCHAR(255)', isNullable: false, isUnique: true },
      password_hash: { name: 'password_hash', type: 'VARCHAR(255)', isNullable: false },
      role: { name: 'role', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'member', check: "role IN ('member', 'admin', 'guest')" },
      email_verified: { name: 'email_verified', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      verification_token: { name: 'verification_token', type: 'VARCHAR(255)', isNullable: true },
      display_name: { name: 'display_name', type: 'VARCHAR(100)', isNullable: false },
      headline: { name: 'headline', type: 'VARCHAR(200)', isNullable: true },
      bio: { name: 'bio', type: 'TEXT', isNullable: true },
      avatar_url: { name: 'avatar_url', type: 'TEXT', isNullable: true },
      primary_life_focus: { name: 'primary_life_focus', type: 'VARCHAR(200)', isNullable: true },
      theme: { name: 'theme', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'system', check: "theme IN ('system', 'light', 'dark')" },
      timezone: { name: 'timezone', type: 'VARCHAR(100)', isNullable: false, defaultValue: 'UTC' },
      locale: { name: 'locale', type: 'VARCHAR(50)', isNullable: false, defaultValue: 'en-US' },
      week_start_day: { name: 'week_start_day', type: 'SMALLINT', isNullable: false, defaultValue: 1, check: 'week_start_day IN (0, 1, 6)' },
      reduced_motion: { name: 'reduced_motion', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      compact_density: { name: 'compact_density', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      daily_reflection_reminder_time: { name: 'daily_reflection_reminder_time', type: 'VARCHAR(20)', isNullable: true },
      notification_channels: { name: 'notification_channels', type: 'JSONB', isNullable: false, defaultValue: '{"inApp": true, "email": true, "dailyDigest": false}' },
      unlocked_modules: { name: 'unlocked_modules', type: 'JSONB', isNullable: false, defaultValue: '[]' },
      subscription_tier: { name: 'subscription_tier', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'free', check: "subscription_tier IN ('free', 'pro', 'lifetime')" },
      subscription_status: { name: 'subscription_status', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'active', check: "subscription_status IN ('active', 'trialing', 'canceled', 'past_due')" },
      subscription_current_period_end: { name: 'subscription_current_period_end', type: 'TIMESTAMPTZ', isNullable: true },
      subscription_cancel_at_period_end: { name: 'subscription_cancel_at_period_end', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      stripe_customer_id: { name: 'stripe_customer_id', type: 'VARCHAR(255)', isNullable: true },
      stripe_subscription_id: { name: 'stripe_subscription_id', type: 'VARCHAR(255)', isNullable: true },
      last_login_at: { name: 'last_login_at', type: 'TIMESTAMPTZ', isNullable: true },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [],
    uniqueConstraints: [{ name: 'uq_users_email', columns: ['email'] }],
    indexes: [
      { name: 'idx_users_email', columns: ['email'] },
      { name: 'idx_users_verification_token', columns: ['verification_token'], whereClause: 'verification_token IS NOT NULL' },
      { name: 'idx_users_stripe_customer_id', columns: ['stripe_customer_id'], whereClause: 'stripe_customer_id IS NOT NULL' },
    ],
  },

  note_folders: {
    name: 'note_folders',
    description: 'Organizational folders for note categorization.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      name: { name: 'name', type: 'VARCHAR(100)', isNullable: false },
      color: { name: 'color', type: 'VARCHAR(50)', isNullable: true },
      icon: { name: 'icon', type: 'VARCHAR(50)', isNullable: true },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [{ name: 'idx_note_folders_user_id', columns: ['user_id'] }],
  },

  goals: {
    name: 'goals',
    description: 'Strategic long-term and horizon life goals.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      title: { name: 'title', type: 'VARCHAR(300)', isNullable: false },
      description: { name: 'description', type: 'TEXT', isNullable: true },
      category: { name: 'category', type: 'VARCHAR(100)', isNullable: false, defaultValue: 'personal' },
      horizon: { name: 'horizon', type: 'VARCHAR(30)', isNullable: false, defaultValue: 'annual', check: "horizon IN ('quarterly', 'annual', 'multi_year', 'lifetime', 'monthly')" },
      target_date: { name: 'target_date', type: 'DATE', isNullable: false },
      progress_percentage: { name: 'progress_percentage', type: 'NUMERIC(5, 2)', isNullable: false, defaultValue: 0.0, check: 'progress_percentage >= 0 AND progress_percentage <= 100' },
      status: { name: 'status', type: 'VARCHAR(30)', isNullable: false, defaultValue: 'active', check: "status IN ('active', 'achieved', 'paused', 'archived', 'completed', 'cancelled')" },
      success_criteria: { name: 'success_criteria', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_goals_user_id', columns: ['user_id'] },
      { name: 'idx_goals_user_status', columns: ['user_id', 'status'] },
      { name: 'idx_goals_user_target_date', columns: ['user_id', 'target_date'] },
    ],
  },

  goal_milestones: {
    name: 'goal_milestones',
    description: 'Milestones that track granular progress toward goal achievement.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      goal_id: { name: 'goal_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'goals', column: 'id', onDelete: 'CASCADE' } },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      title: { name: 'title', type: 'VARCHAR(300)', isNullable: false },
      completed: { name: 'completed', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      target_date: { name: 'target_date', type: 'DATE', isNullable: true },
      completed_at: { name: 'completed_at', type: 'TIMESTAMPTZ', isNullable: true },
      weight: { name: 'weight', type: 'NUMERIC(5, 2)', isNullable: false, defaultValue: 0.0 },
      order_index: { name: 'order_index', type: 'INTEGER', isNullable: false, defaultValue: 0 },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['goal_id'], referencedTable: 'goals', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_goal_milestones_goal_id', columns: ['goal_id'] },
      { name: 'idx_goal_milestones_user_id', columns: ['user_id'] },
    ],
  },

  tasks: {
    name: 'tasks',
    description: 'Action items, scheduled tasks, and deep work units.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      goal_id: { name: 'goal_id', type: 'VARCHAR(100)', isNullable: true, foreignKey: { table: 'goals', column: 'id', onDelete: 'SET NULL' } },
      title: { name: 'title', type: 'VARCHAR(500)', isNullable: false },
      description: { name: 'description', type: 'TEXT', isNullable: true },
      priority: { name: 'priority', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'medium', check: "priority IN ('low', 'medium', 'high', 'urgent')" },
      status: { name: 'status', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'todo', check: "status IN ('backlog', 'todo', 'in_progress', 'blocked', 'completed', 'canceled', 'cancelled')" },
      due_date: { name: 'due_date', type: 'TIMESTAMPTZ', isNullable: true },
      scheduled_time: { name: 'scheduled_time', type: 'VARCHAR(50)', isNullable: true },
      estimated_minutes: { name: 'estimated_minutes', type: 'INTEGER', isNullable: true, check: 'estimated_minutes IS NULL OR estimated_minutes >= 0' },
      actual_minutes: { name: 'actual_minutes', type: 'INTEGER', isNullable: true, check: 'actual_minutes IS NULL OR actual_minutes >= 0' },
      tags: { name: 'tags', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      completed_at: { name: 'completed_at', type: 'TIMESTAMPTZ', isNullable: true },
      recurrence: { name: 'recurrence', type: 'JSONB', isNullable: true },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['goal_id'], referencedTable: 'goals', referencedColumns: ['id'], onDelete: 'SET NULL' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_tasks_user_id', columns: ['user_id'] },
      { name: 'idx_tasks_user_status', columns: ['user_id', 'status'] },
      { name: 'idx_tasks_user_due_date', columns: ['user_id', 'due_date'] },
      { name: 'idx_tasks_goal_id', columns: ['goal_id'], whereClause: 'goal_id IS NOT NULL' },
    ],
  },

  task_subtasks: {
    name: 'task_subtasks',
    description: 'Checklist sub-items under a parent task.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      task_id: { name: 'task_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'tasks', column: 'id', onDelete: 'CASCADE' } },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      title: { name: 'title', type: 'VARCHAR(300)', isNullable: false },
      completed: { name: 'completed', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      completed_at: { name: 'completed_at', type: 'TIMESTAMPTZ', isNullable: true },
      order_index: { name: 'order_index', type: 'INTEGER', isNullable: false, defaultValue: 0 },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['task_id'], referencedTable: 'tasks', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_task_subtasks_task_id', columns: ['task_id'] },
      { name: 'idx_task_subtasks_user_id', columns: ['user_id'] },
    ],
  },

  habits: {
    name: 'habits',
    description: 'Daily routines, habit cues, cadence schedules, and streak tracking.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      goal_id: { name: 'goal_id', type: 'VARCHAR(100)', isNullable: true, foreignKey: { table: 'goals', column: 'id', onDelete: 'SET NULL' } },
      name: { name: 'name', type: 'VARCHAR(300)', isNullable: false },
      description: { name: 'description', type: 'TEXT', isNullable: true },
      cue: { name: 'cue', type: 'TEXT', isNullable: true },
      routine: { name: 'routine', type: 'TEXT', isNullable: true },
      reward: { name: 'reward', type: 'TEXT', isNullable: true },
      category: { name: 'category', type: 'VARCHAR(100)', isNullable: false, defaultValue: 'health' },
      frequency: { name: 'frequency', type: 'VARCHAR(30)', isNullable: false, defaultValue: 'daily', check: "frequency IN ('daily', 'weekdays', 'weekends', 'three_times_weekly', 'custom', 'custom_days', 'weekly')" },
      target_days: { name: 'target_days', type: 'INTEGER[]', isNullable: false, defaultValue: '{}' },
      target_per_day: { name: 'target_per_day', type: 'INTEGER', isNullable: false, defaultValue: 1, check: 'target_per_day > 0' },
      target_units: { name: 'target_units', type: 'NUMERIC(10, 2)', isNullable: false, defaultValue: 1.0 },
      unit: { name: 'unit', type: 'VARCHAR(50)', isNullable: true, defaultValue: 'times' },
      unit_label: { name: 'unit_label', type: 'VARCHAR(50)', isNullable: true },
      time_of_day: { name: 'time_of_day', type: 'VARCHAR(30)', isNullable: false, defaultValue: 'anytime', check: "time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')" },
      reminder_time: { name: 'reminder_time', type: 'VARCHAR(50)', isNullable: true },
      streak_count: { name: 'streak_count', type: 'INTEGER', isNullable: false, defaultValue: 0 },
      best_streak: { name: 'best_streak', type: 'INTEGER', isNullable: false, defaultValue: 0 },
      total_completions: { name: 'total_completions', type: 'INTEGER', isNullable: false, defaultValue: 0 },
      archived: { name: 'archived', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      why: { name: 'why', type: 'TEXT', isNullable: true },
      icon: { name: 'icon', type: 'VARCHAR(50)', isNullable: true },
      color: { name: 'color', type: 'VARCHAR(50)', isNullable: true },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['goal_id'], referencedTable: 'goals', referencedColumns: ['id'], onDelete: 'SET NULL' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_habits_user_id', columns: ['user_id'] },
      { name: 'idx_habits_user_archived', columns: ['user_id', 'archived'] },
      { name: 'idx_habits_goal_id', columns: ['goal_id'], whereClause: 'goal_id IS NOT NULL' },
    ],
  },

  habit_logs: {
    name: 'habit_logs',
    description: 'Daily habit execution logs and completion units.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      habit_id: { name: 'habit_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'habits', column: 'id', onDelete: 'CASCADE' } },
      date: { name: 'date', type: 'DATE', isNullable: false },
      completed: { name: 'completed', type: 'BOOLEAN', isNullable: false, defaultValue: true },
      value: { name: 'value', type: 'NUMERIC(10, 2)', isNullable: false, defaultValue: 1.0 },
      notes: { name: 'notes', type: 'TEXT', isNullable: true },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['habit_id'], referencedTable: 'habits', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [{ name: 'uq_habit_logs_user_habit_date', columns: ['user_id', 'habit_id', 'date'] }],
    indexes: [
      { name: 'idx_habit_logs_user_id', columns: ['user_id'] },
      { name: 'idx_habit_logs_habit_id', columns: ['habit_id'] },
      { name: 'idx_habit_logs_user_date', columns: ['user_id', 'date'] },
    ],
  },

  financial_transactions: {
    name: 'financial_transactions',
    description: 'Income, expense, and monetary exchange records with integer minor unit precision.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      title: { name: 'title', type: 'VARCHAR(300)', isNullable: false },
      amount: { name: 'amount', type: 'NUMERIC(12, 2)', isNullable: false },
      minor_units: { name: 'minor_units', type: 'BIGINT', isNullable: false },
      currency: { name: 'currency', type: 'VARCHAR(10)', isNullable: false, defaultValue: 'USD' },
      type: { name: 'type', type: 'VARCHAR(20)', isNullable: false, check: "type IN ('income', 'expense')" },
      category: { name: 'category', type: 'VARCHAR(100)', isNullable: false },
      date: { name: 'date', type: 'DATE', isNullable: false },
      payment_method: { name: 'payment_method', type: 'VARCHAR(100)', isNullable: true },
      is_recurring: { name: 'is_recurring', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      merchant_or_source: { name: 'merchant_or_source', type: 'VARCHAR(200)', isNullable: true },
      notes: { name: 'notes', type: 'TEXT', isNullable: true },
      tags: { name: 'tags', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      is_encrypted: { name: 'is_encrypted', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_financial_transactions_user_id', columns: ['user_id'] },
      { name: 'idx_financial_transactions_user_date', columns: ['user_id', 'date'] },
      { name: 'idx_financial_transactions_user_type', columns: ['user_id', 'type'] },
      { name: 'idx_financial_transactions_user_category', columns: ['user_id', 'category'] },
    ],
  },

  budgets: {
    name: 'budgets',
    description: 'Spending boundaries and periodic threshold monitoring.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      category: { name: 'category', type: 'VARCHAR(100)', isNullable: false },
      limit_amount: { name: 'limit_amount', type: 'NUMERIC(12, 2)', isNullable: false },
      limit_minor_units: { name: 'limit_minor_units', type: 'BIGINT', isNullable: false },
      period: { name: 'period', type: 'VARCHAR(30)', isNullable: false, defaultValue: 'monthly', check: "period IN ('monthly', 'weekly', 'quarterly', 'annual', 'yearly')" },
      month_year: { name: 'month_year', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'all' },
      alert_threshold_percentage: { name: 'alert_threshold_percentage', type: 'NUMERIC(5, 2)', isNullable: false, defaultValue: 80.0 },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [
      { name: 'uq_budgets_user_cat_period_month', columns: ['user_id', 'category', 'period', 'month_year'] },
    ],
    indexes: [
      { name: 'idx_budgets_user_id', columns: ['user_id'] },
      { name: 'idx_budgets_user_category', columns: ['user_id', 'category'] },
    ],
  },

  reflections: {
    name: 'reflections',
    description: 'Emotional energy, clarity, stress levels, daily wins, gratitudes, and private journals.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      date: { name: 'date', type: 'DATE', isNullable: false },
      energy_level: { name: 'energy_level', type: 'SMALLINT', isNullable: false, defaultValue: 5, check: 'energy_level >= 1 AND energy_level <= 10' },
      clarity_level: { name: 'clarity_level', type: 'SMALLINT', isNullable: false, defaultValue: 5, check: 'clarity_level >= 1 AND clarity_level <= 10' },
      stress_level: { name: 'stress_level', type: 'SMALLINT', isNullable: false, defaultValue: 5, check: 'stress_level >= 1 AND stress_level <= 10' },
      mood: { name: 'mood', type: 'SMALLINT', isNullable: true, check: 'mood IS NULL OR (mood >= 1 AND mood <= 5)' },
      primary_emotion: { name: 'primary_emotion', type: 'VARCHAR(100)', isNullable: false, defaultValue: 'neutral' },
      journal_entry: { name: 'journal_entry', type: 'TEXT', isNullable: true },
      reflection: { name: 'reflection', type: 'TEXT', isNullable: true },
      wins: { name: 'wins', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      gratitudes: { name: 'gratitudes', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      learnings: { name: 'learnings', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      tags: { name: 'tags', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      is_encrypted: { name: 'is_encrypted', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [{ name: 'uq_reflections_user_date', columns: ['user_id', 'date'] }],
    indexes: [
      { name: 'idx_reflections_user_id', columns: ['user_id'] },
      { name: 'idx_reflections_user_date', columns: ['user_id', 'date'] },
    ],
  },

  relationships: {
    name: 'relationships',
    description: 'Personal CRM contacts, connection cadence, and interaction management.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      name: { name: 'name', type: 'VARCHAR(200)', isNullable: false },
      relation_type: { name: 'relation_type', type: 'VARCHAR(50)', isNullable: false, defaultValue: 'friend', check: "relation_type IN ('family', 'friend', 'close_friend', 'mentor', 'colleague', 'partner', 'community', 'network', 'client', 'other')" },
      cadence_days: { name: 'cadence_days', type: 'INTEGER', isNullable: false, defaultValue: 30, check: 'cadence_days > 0' },
      last_interaction_date: { name: 'last_interaction_date', type: 'DATE', isNullable: true },
      next_due_reminder_date: { name: 'next_due_reminder_date', type: 'DATE', isNullable: true },
      notes: { name: 'notes', type: 'TEXT', isNullable: true },
      tags: { name: 'tags', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      is_encrypted: { name: 'is_encrypted', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_relationships_user_id', columns: ['user_id'] },
      { name: 'idx_relationships_user_next_reminder', columns: ['user_id', 'next_due_reminder_date'] },
    ],
  },

  relationship_important_dates: {
    name: 'relationship_important_dates',
    description: 'Birthdays, anniversaries, and key milestones associated with a relationship.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      relationship_id: { name: 'relationship_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'relationships', column: 'id', onDelete: 'CASCADE' } },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      label: { name: 'label', type: 'VARCHAR(100)', isNullable: false },
      date: { name: 'date', type: 'VARCHAR(50)', isNullable: false },
      recurring_yearly: { name: 'recurring_yearly', type: 'BOOLEAN', isNullable: false, defaultValue: true },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['relationship_id'], referencedTable: 'relationships', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_rel_dates_relationship_id', columns: ['relationship_id'] },
      { name: 'idx_rel_dates_user_id', columns: ['user_id'] },
    ],
  },

  contact_interactions: {
    name: 'contact_interactions',
    description: 'Individual touchpoints, calls, and meetings logged with a relationship contact.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      contact_id: { name: 'contact_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'relationships', column: 'id', onDelete: 'CASCADE' } },
      date: { name: 'date', type: 'DATE', isNullable: false },
      channel: { name: 'channel', type: 'VARCHAR(50)', isNullable: false, check: "channel IN ('in_person', 'call', 'video', 'message', 'email', 'letter_gift', 'shared_activity')" },
      notes: { name: 'notes', type: 'TEXT', isNullable: true },
      energy_impact: { name: 'energy_impact', type: 'VARCHAR(30)', isNullable: true, check: "energy_impact IS NULL OR energy_impact IN ('energizing', 'neutral', 'draining')" },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['contact_id'], referencedTable: 'relationships', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_contact_interactions_user_id', columns: ['user_id'] },
      { name: 'idx_contact_interactions_contact_id', columns: ['contact_id'] },
      { name: 'idx_contact_interactions_user_date', columns: ['user_id', 'date'] },
    ],
  },

  notes: {
    name: 'notes',
    description: 'Markdown notes, knowledge items, linked goals, and linked tasks.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      folder_id: { name: 'folder_id', type: 'VARCHAR(100)', isNullable: true, foreignKey: { table: 'note_folders', column: 'id', onDelete: 'SET NULL' } },
      linked_goal_id: { name: 'linked_goal_id', type: 'VARCHAR(100)', isNullable: true, foreignKey: { table: 'goals', column: 'id', onDelete: 'SET NULL' } },
      linked_task_id: { name: 'linked_task_id', type: 'VARCHAR(100)', isNullable: true, foreignKey: { table: 'tasks', column: 'id', onDelete: 'SET NULL' } },
      title: { name: 'title', type: 'VARCHAR(300)', isNullable: false, defaultValue: 'Untitled' },
      content: { name: 'content', type: 'TEXT', isNullable: false, defaultValue: '' },
      plain_text_summary: { name: 'plain_text_summary', type: 'TEXT', isNullable: true },
      tags: { name: 'tags', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      is_pinned: { name: 'is_pinned', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      is_archived: { name: 'is_archived', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      word_count: { name: 'word_count', type: 'INTEGER', isNullable: false, defaultValue: 0 },
      linked_note_ids: { name: 'linked_note_ids', type: 'TEXT[]', isNullable: false, defaultValue: '{}' },
      is_encrypted: { name: 'is_encrypted', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['folder_id'], referencedTable: 'note_folders', referencedColumns: ['id'], onDelete: 'SET NULL' },
      { columns: ['linked_goal_id'], referencedTable: 'goals', referencedColumns: ['id'], onDelete: 'SET NULL' },
      { columns: ['linked_task_id'], referencedTable: 'tasks', referencedColumns: ['id'], onDelete: 'SET NULL' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_notes_user_id', columns: ['user_id'] },
      { name: 'idx_notes_user_folder', columns: ['user_id', 'folder_id'] },
      { name: 'idx_notes_user_pinned', columns: ['user_id', 'is_pinned'] },
      { name: 'idx_notes_user_archived', columns: ['user_id', 'is_archived'] },
      { name: 'idx_notes_linked_goal_id', columns: ['linked_goal_id'], whereClause: 'linked_goal_id IS NOT NULL' },
      { name: 'idx_notes_linked_task_id', columns: ['linked_task_id'], whereClause: 'linked_task_id IS NOT NULL' },
    ],
  },

  ai_memories: {
    name: 'ai_memories',
    description: 'Long-term user preferences and contextual memory for ORIGIN AI.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      key: { name: 'key', type: 'VARCHAR(200)', isNullable: false },
      value: { name: 'value', type: 'TEXT', isNullable: false },
      category: { name: 'category', type: 'VARCHAR(50)', isNullable: false, defaultValue: 'preference', check: "category IN ('preference', 'routine', 'goal_focus', 'constraint', 'wellness', 'financial', 'planning', 'general')" },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [{ name: 'uq_ai_memories_user_key', columns: ['user_id', 'key'] }],
    indexes: [
      { name: 'idx_ai_memories_user_id', columns: ['user_id'] },
      { name: 'idx_ai_memories_user_category', columns: ['user_id', 'category'] },
    ],
  },

  audit_logs: {
    name: 'audit_logs',
    description: 'Security, compliance, and user action audit log stream.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      action: { name: 'action', type: 'VARCHAR(100)', isNullable: false },
      resource: { name: 'resource', type: 'VARCHAR(100)', isNullable: false },
      ip_address: { name: 'ip_address', type: 'VARCHAR(100)', isNullable: true },
      user_agent: { name: 'user_agent', type: 'TEXT', isNullable: true },
      metadata: { name: 'metadata', type: 'JSONB', isNullable: true },
      timestamp: { name: 'timestamp', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_audit_logs_user_id', columns: ['user_id'] },
      { name: 'idx_audit_logs_timestamp', columns: ['timestamp'] },
      { name: 'idx_audit_logs_user_timestamp', columns: ['user_id', 'timestamp DESC'] },
    ],
  },

  password_reset_tokens: {
    name: 'password_reset_tokens',
    description: 'Ephemeral single-use tokens for secure password recovery.',
    primaryKey: ['token'],
    columns: {
      token: { name: 'token', type: 'VARCHAR(255)', isPrimary: true, isNullable: false },
      email: { name: 'email', type: 'VARCHAR(255)', isNullable: false },
      expires_at: { name: 'expires_at', type: 'TIMESTAMPTZ', isNullable: false },
      used: { name: 'used', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_pwd_resets_email', columns: ['email'] },
      { name: 'idx_pwd_resets_expires_at', columns: ['expires_at'] },
    ],
  },

  scheduled_notifications: {
    name: 'scheduled_notifications',
    description: 'Server-side scheduled notifications and background reminder triggers.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      type: { name: 'type', type: 'VARCHAR(50)', isNullable: false, defaultValue: 'custom_reminder', check: "type IN ('task_reminder', 'habit_reminder', 'goal_deadline', 'relationship_reminder', 'budget_alert', 'system_update', 'system_alert', 'custom_reminder')" },
      title: { name: 'title', type: 'VARCHAR(500)', isNullable: false },
      message: { name: 'message', type: 'TEXT', isNullable: false },
      priority: { name: 'priority', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'medium', check: "priority IN ('low', 'medium', 'high', 'urgent')" },
      scheduled_for: { name: 'scheduled_for', type: 'TIMESTAMPTZ', isNullable: false },
      status: { name: 'status', type: 'VARCHAR(30)', isNullable: false, defaultValue: 'scheduled', check: "status IN ('scheduled', 'delivered', 'canceled', 'failed')" },
      delivered_at: { name: 'delivered_at', type: 'TIMESTAMPTZ', isNullable: true },
      action_url: { name: 'action_url', type: 'VARCHAR(500)', isNullable: true },
      entity_type: { name: 'entity_type', type: 'VARCHAR(50)', isNullable: true, check: "entity_type IS NULL OR entity_type IN ('task', 'habit', 'goal', 'relationship', 'budget', 'system')" },
      entity_id: { name: 'entity_id', type: 'VARCHAR(100)', isNullable: true },
      metadata: { name: 'metadata', type: 'JSONB', isNullable: true },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_sched_notifs_user_id', columns: ['user_id'] },
      { name: 'idx_sched_notifs_status_due', columns: ['status', 'scheduled_for'] },
      { name: 'idx_sched_notifs_user_status', columns: ['user_id', 'status'] },
    ],
  },

  notifications: {
    name: 'notifications',
    description: 'Delivered in-app inbox notifications and alerts.',
    primaryKey: ['id'],
    columns: {
      id: { name: 'id', type: 'VARCHAR(100)', isPrimary: true, isNullable: false },
      user_id: { name: 'user_id', type: 'VARCHAR(100)', isNullable: false, foreignKey: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      scheduled_notification_id: { name: 'scheduled_notification_id', type: 'VARCHAR(100)', isNullable: true, foreignKey: { table: 'scheduled_notifications', column: 'id', onDelete: 'SET NULL' } },
      type: { name: 'type', type: 'VARCHAR(50)', isNullable: false, defaultValue: 'system_alert', check: "type IN ('task_reminder', 'habit_reminder', 'goal_deadline', 'relationship_reminder', 'budget_alert', 'system_update', 'system_alert', 'custom_reminder')" },
      title: { name: 'title', type: 'VARCHAR(500)', isNullable: false },
      message: { name: 'message', type: 'TEXT', isNullable: false },
      priority: { name: 'priority', type: 'VARCHAR(20)', isNullable: false, defaultValue: 'medium', check: "priority IN ('low', 'medium', 'high', 'urgent')" },
      is_read: { name: 'is_read', type: 'BOOLEAN', isNullable: false, defaultValue: false },
      read_at: { name: 'read_at', type: 'TIMESTAMPTZ', isNullable: true },
      action_url: { name: 'action_url', type: 'VARCHAR(500)', isNullable: true },
      entity_type: { name: 'entity_type', type: 'VARCHAR(50)', isNullable: true, check: "entity_type IS NULL OR entity_type IN ('task', 'habit', 'goal', 'relationship', 'budget', 'system')" },
      entity_id: { name: 'entity_id', type: 'VARCHAR(100)', isNullable: true },
      created_at: { name: 'created_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      updated_at: { name: 'updated_at', type: 'TIMESTAMPTZ', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    },
    foreignKeys: [
      { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { columns: ['scheduled_notification_id'], referencedTable: 'scheduled_notifications', referencedColumns: ['id'], onDelete: 'SET NULL' },
    ],
    uniqueConstraints: [],
    indexes: [
      { name: 'idx_notifications_user_id', columns: ['user_id'] },
      { name: 'idx_notifications_user_unread', columns: ['user_id', 'is_read'] },
      { name: 'idx_notifications_user_created', columns: ['user_id', 'created_at DESC'] },
      { name: 'idx_notifications_sched_id', columns: ['scheduled_notification_id'], whereClause: 'scheduled_notification_id IS NOT NULL' },
    ],
  },
};
