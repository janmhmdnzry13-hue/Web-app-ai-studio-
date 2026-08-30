/**
 * ORIGIN JSON to PostgreSQL Safe Migration Pipeline
 *
 * Responsibilities:
 * 1. Read source data from JSON structure / file.
 * 2. Validate records and check for required fields, referential integrity, and type safety.
 * 3. Map entities faithfully to PostgreSQL schema (tables, foreign keys, timestamps, numeric precision).
 * 4. Generate idempotent SQL / DML statements (INSERT ... ON CONFLICT DO UPDATE or DO NOTHING).
 * 5. Provide an executable batch runner that operates within a transactional context.
 * 6. Track detailed per-entity migration metrics and report anomalies / warnings / errors explicitly.
 */

import fs from 'fs';
import path from 'path';
import type {
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
  DatabaseSchema,
} from '../db.js';

export interface MigrationEntityStats {
  foundInSource: number;
  valid: number;
  invalid: number;
  mappedRows: number;
}

export interface MigrationReport {
  success: boolean;
  totalFound: number;
  totalMapped: number;
  totalInvalid: number;
  entityStats: Record<string, MigrationEntityStats>;
  errors: string[];
  warnings: string[];
  executionTimeMs: number;
}

export interface MappedRow {
  table: string;
  id: string;
  columns: Record<string, any>;
  conflictTarget: string[];
  updateColumns?: string[];
}

export interface MigrationPlan {
  orderedTables: string[];
  rowsByTable: Record<string, MappedRow[]>;
  allRowsOrdered: MappedRow[];
  report: MigrationReport;
}

export interface DatabaseExecutor {
  query: (sql: string, params?: any[]) => Promise<any>;
}

// Format utilities
export function formatSqlValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (Array.isArray(val)) {
    // Format PostgreSQL array e.g. ARRAY['a', 'b']
    if (val.length === 0) return "'{}'";
    const escapedItems = val.map((item) => {
      if (typeof item === 'number') return item;
      const str = String(item).replace(/'/g, "''");
      return `'${str}'`;
    });
    return `ARRAY[${escapedItems.join(', ')}]`;
  }
  if (typeof val === 'object') {
    // JSON / JSONB
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  // String or date
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

export function escapeIdentifier(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

/**
 * Migration Pipeline Engine
 */
export class JsonToPostgresMigrator {
  /**
   * Reads raw JSON database file safely.
   */
  public static readJsonDb(filePath?: string): DatabaseSchema {
    const targetPath = filePath || path.join(process.cwd(), 'data', 'origin_db.json');
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Migration source file not found at: ${targetPath}`);
    }
    const rawContent = fs.readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(rawContent);
    return parsed as DatabaseSchema;
  }

  /**
   * Plans the migration by transforming JSON entities into relational rows with validations.
   */
  public static planMigration(data: Partial<DatabaseSchema>): MigrationPlan {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    const stats: Record<string, MigrationEntityStats> = {
      users: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      goals: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      goal_milestones: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      tasks: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      task_subtasks: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      habits: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      habit_logs: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      financial_transactions: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      budgets: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      reflections: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      relationships: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      relationship_important_dates: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      contact_interactions: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      note_folders: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      notes: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      ai_memories: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      audit_logs: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      password_reset_tokens: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      scheduled_notifications: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
      notifications: { foundInSource: 0, valid: 0, invalid: 0, mappedRows: 0 },
    };

    const rowsByTable: Record<string, MappedRow[]> = {
      users: [],
      goals: [],
      goal_milestones: [],
      tasks: [],
      task_subtasks: [],
      habits: [],
      habit_logs: [],
      financial_transactions: [],
      budgets: [],
      reflections: [],
      relationships: [],
      relationship_important_dates: [],
      contact_interactions: [],
      note_folders: [],
      notes: [],
      ai_memories: [],
      audit_logs: [],
      password_reset_tokens: [],
      scheduled_notifications: [],
      notifications: [],
    };

    // Tracking user IDs and other FK sets for referential validation
    const knownUserIds = new Set<string>();
    const knownGoalIds = new Set<string>();
    const knownTaskIds = new Set<string>();
    const knownHabitIds = new Set<string>();
    const knownRelationshipIds = new Set<string>();
    const knownSchedNotifIds = new Set<string>();

    // 1. Users
    const users = data.users || [];
    stats.users.foundInSource = users.length;
    for (const u of users) {
      if (!u.id || !u.email || !u.passwordHash) {
        stats.users.invalid++;
        errors.push(`Invalid user record: missing id, email or passwordHash: ${JSON.stringify(u)}`);
        continue;
      }
      knownUserIds.add(u.id);
      stats.users.valid++;

      const displayName = u.profile?.displayName || u.email.split('@')[0] || 'User';
      const notificationChannels = u.preferences?.notificationChannels || { inApp: true, email: true, dailyDigest: false };
      const unlockedModules = u.preferences?.unlockedModules || [];

      rowsByTable.users.push({
        table: 'users',
        id: u.id,
        columns: {
          id: u.id,
          email: u.email,
          password_hash: u.passwordHash,
          role: u.role || 'member',
          email_verified: Boolean(u.emailVerified),
          verification_token: u.verificationToken || null,
          display_name: displayName,
          headline: u.profile?.headline || null,
          bio: u.profile?.bio || null,
          avatar_url: u.profile?.avatarUrl || null,
          primary_life_focus: u.profile?.primaryLifeFocus || null,
          theme: u.preferences?.theme || 'system',
          timezone: u.preferences?.timezone || 'UTC',
          locale: u.preferences?.locale || 'en-US',
          week_start_day: typeof u.preferences?.weekStartDay === 'number' ? u.preferences.weekStartDay : 1,
          reduced_motion: Boolean(u.preferences?.reducedMotion),
          compact_density: Boolean(u.preferences?.compactDensity),
          daily_reflection_reminder_time: u.preferences?.dailyReflectionReminderTime || null,
          notification_channels: notificationChannels,
          unlocked_modules: unlockedModules,
          subscription_tier: u.subscription?.tier || 'free',
          subscription_status: u.subscription?.status || 'active',
          subscription_current_period_end: u.subscription?.currentPeriodEnd ? new Date(u.subscription.currentPeriodEnd).toISOString() : null,
          subscription_cancel_at_period_end: Boolean(u.subscription?.cancelAtPeriodEnd),
          stripe_customer_id: u.subscription?.stripeCustomerId || null,
          stripe_subscription_id: u.subscription?.stripeSubscriptionId || null,
          last_login_at: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
          created_at: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
          updated_at: u.updatedAt ? new Date(u.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'email', 'password_hash', 'role', 'email_verified', 'verification_token',
          'display_name', 'headline', 'bio', 'avatar_url', 'primary_life_focus',
          'theme', 'timezone', 'locale', 'week_start_day', 'reduced_motion',
          'compact_density', 'daily_reflection_reminder_time', 'notification_channels',
          'unlocked_modules', 'subscription_tier', 'subscription_status',
          'subscription_current_period_end', 'subscription_cancel_at_period_end',
          'stripe_customer_id', 'stripe_subscription_id', 'last_login_at', 'updated_at'
        ],
      });
      stats.users.mappedRows++;
    }

    // Helper to validate user ownership
    const checkUserOwnership = (entityName: string, entityId: string, userId: string): boolean => {
      if (!userId) {
        errors.push(`${entityName} [${entityId}] is missing required userId foreign key.`);
        return false;
      }
      if (!knownUserIds.has(userId)) {
        warnings.push(`${entityName} [${entityId}] references non-existent userId [${userId}].`);
      }
      return true;
    };

    // 2. Goals & Milestones
    const goals = data.goals || [];
    stats.goals.foundInSource = goals.length;
    for (const g of goals) {
      if (!g.id || !g.title) {
        stats.goals.invalid++;
        errors.push(`Goal missing required fields (id, title): ${JSON.stringify(g)}`);
        continue;
      }
      if (!checkUserOwnership('Goal', g.id, g.userId)) {
        stats.goals.invalid++;
        continue;
      }
      knownGoalIds.add(g.id);
      stats.goals.valid++;

      const targetDate = g.targetDate ? g.targetDate.substring(0, 10) : new Date().toISOString().substring(0, 10);
      const progress = typeof g.progressPercentage === 'number' ? Math.min(100, Math.max(0, g.progressPercentage)) : 0;

      rowsByTable.goals.push({
        table: 'goals',
        id: g.id,
        columns: {
          id: g.id,
          user_id: g.userId,
          title: g.title,
          description: g.description || null,
          category: g.category || 'personal',
          horizon: g.horizon || 'annual',
          target_date: targetDate,
          progress_percentage: Number(progress.toFixed(2)),
          status: g.status || 'active',
          success_criteria: [],
          created_at: g.createdAt ? new Date(g.createdAt).toISOString() : new Date().toISOString(),
          updated_at: g.updatedAt ? new Date(g.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: ['user_id', 'title', 'description', 'category', 'horizon', 'target_date', 'progress_percentage', 'status', 'updated_at'],
      });
      stats.goals.mappedRows++;

      // Milestones
      if (Array.isArray(g.milestones)) {
        stats.goal_milestones.foundInSource += g.milestones.length;
        g.milestones.forEach((m, idx) => {
          if (!m.id || !m.title) {
            stats.goal_milestones.invalid++;
            warnings.push(`Goal milestone in goal [${g.id}] missing id or title: ${JSON.stringify(m)}`);
            return;
          }
          stats.goal_milestones.valid++;
          const milestoneTargetDate = m.dueDate ? m.dueDate.substring(0, 10) : null;
          rowsByTable.goal_milestones.push({
            table: 'goal_milestones',
            id: m.id,
            columns: {
              id: m.id,
              goal_id: g.id,
              user_id: g.userId,
              title: m.title,
              completed: Boolean(m.completed),
              target_date: milestoneTargetDate,
              completed_at: m.completed ? new Date().toISOString() : null,
              weight: 0.0,
              order_index: typeof m.order === 'number' ? m.order : idx,
              created_at: g.createdAt ? new Date(g.createdAt).toISOString() : new Date().toISOString(),
              updated_at: g.updatedAt ? new Date(g.updatedAt).toISOString() : new Date().toISOString(),
            },
            conflictTarget: ['id'],
            updateColumns: ['title', 'completed', 'target_date', 'completed_at', 'order_index', 'updated_at'],
          });
          stats.goal_milestones.mappedRows++;
        });
      }
    }

    // 3. Tasks & Subtasks
    const tasks = data.tasks || [];
    stats.tasks.foundInSource = tasks.length;
    for (const t of tasks) {
      if (!t.id || !t.title) {
        stats.tasks.invalid++;
        errors.push(`Task missing required fields (id, title): ${JSON.stringify(t)}`);
        continue;
      }
      if (!checkUserOwnership('Task', t.id, t.userId)) {
        stats.tasks.invalid++;
        continue;
      }
      knownTaskIds.add(t.id);
      stats.tasks.valid++;

      let validGoalId: string | null = null;
      if (t.goalId) {
        if (knownGoalIds.has(t.goalId)) {
          validGoalId = t.goalId;
        } else {
          warnings.push(`Task [${t.id}] references unknown goalId [${t.goalId}], setting to NULL.`);
        }
      }

      rowsByTable.tasks.push({
        table: 'tasks',
        id: t.id,
        columns: {
          id: t.id,
          user_id: t.userId,
          goal_id: validGoalId,
          title: t.title,
          description: t.description || null,
          priority: t.priority || 'medium',
          status: t.status || 'todo',
          due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null,
          scheduled_time: t.scheduledTime || null,
          estimated_minutes: typeof t.estimatedMinutes === 'number' ? t.estimatedMinutes : null,
          actual_minutes: typeof t.actualMinutes === 'number' ? t.actualMinutes : null,
          tags: Array.isArray(t.tags) ? t.tags : [],
          completed_at: t.status === 'completed' ? (t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString()) : null,
          recurrence: null,
          created_at: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
          updated_at: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'user_id', 'goal_id', 'title', 'description', 'priority', 'status',
          'due_date', 'scheduled_time', 'estimated_minutes', 'actual_minutes',
          'tags', 'completed_at', 'updated_at'
        ],
      });
      stats.tasks.mappedRows++;

      // Subtasks
      if (Array.isArray(t.subtasks)) {
        stats.task_subtasks.foundInSource += t.subtasks.length;
        t.subtasks.forEach((sub, idx) => {
          if (!sub.id || !sub.title) {
            stats.task_subtasks.invalid++;
            warnings.push(`Task subtask in task [${t.id}] missing id or title: ${JSON.stringify(sub)}`);
            return;
          }
          stats.task_subtasks.valid++;
          rowsByTable.task_subtasks.push({
            table: 'task_subtasks',
            id: sub.id,
            columns: {
              id: sub.id,
              task_id: t.id,
              user_id: t.userId,
              title: sub.title,
              completed: Boolean(sub.completed),
              completed_at: sub.completed ? new Date().toISOString() : null,
              order_index: idx,
              created_at: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
              updated_at: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
            },
            conflictTarget: ['id'],
            updateColumns: ['title', 'completed', 'completed_at', 'order_index', 'updated_at'],
          });
          stats.task_subtasks.mappedRows++;
        });
      }
    }

    // 4. Habits & Habit Logs
    const habits = data.habits || [];
    stats.habits.foundInSource = habits.length;
    for (const h of habits) {
      if (!h.id || !h.name) {
        stats.habits.invalid++;
        errors.push(`Habit missing required fields (id, name): ${JSON.stringify(h)}`);
        continue;
      }
      if (!checkUserOwnership('Habit', h.id, h.userId)) {
        stats.habits.invalid++;
        continue;
      }
      knownHabitIds.add(h.id);
      stats.habits.valid++;

      rowsByTable.habits.push({
        table: 'habits',
        id: h.id,
        columns: {
          id: h.id,
          user_id: h.userId,
          goal_id: null,
          name: h.name,
          description: h.description || null,
          cue: null,
          routine: null,
          reward: null,
          category: h.category || 'health',
          frequency: h.frequency || 'daily',
          target_days: Array.isArray(h.targetDays) ? h.targetDays : [],
          target_per_day: typeof h.targetPerDay === 'number' ? Math.max(1, h.targetPerDay) : 1,
          target_units: 1.0,
          unit: h.unit || 'times',
          unit_label: null,
          time_of_day: 'anytime',
          reminder_time: h.reminderTime || null,
          streak_count: typeof h.streakCount === 'number' ? h.streakCount : 0,
          best_streak: typeof h.bestStreak === 'number' ? h.bestStreak : 0,
          total_completions: typeof h.totalCompletions === 'number' ? h.totalCompletions : 0,
          archived: Boolean(h.archived),
          why: null,
          icon: null,
          color: null,
          created_at: h.createdAt ? new Date(h.createdAt).toISOString() : new Date().toISOString(),
          updated_at: h.updatedAt ? new Date(h.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'name', 'description', 'category', 'frequency', 'target_days', 'target_per_day',
          'unit', 'reminder_time', 'streak_count', 'best_streak', 'total_completions',
          'archived', 'updated_at'
        ],
      });
      stats.habits.mappedRows++;
    }

    const habitLogs = data.habitLogs || [];
    stats.habit_logs.foundInSource = habitLogs.length;
    for (const hl of habitLogs) {
      if (!hl.id || !hl.habitId || !hl.date) {
        stats.habit_logs.invalid++;
        errors.push(`HabitLog missing required fields (id, habitId, date): ${JSON.stringify(hl)}`);
        continue;
      }
      if (!checkUserOwnership('HabitLog', hl.id, hl.userId)) {
        stats.habit_logs.invalid++;
        continue;
      }
      if (!knownHabitIds.has(hl.habitId)) {
        warnings.push(`HabitLog [${hl.id}] references unknown habitId [${hl.habitId}], skipping.`);
        stats.habit_logs.invalid++;
        continue;
      }
      stats.habit_logs.valid++;

      const logDate = hl.date.substring(0, 10);
      rowsByTable.habit_logs.push({
        table: 'habit_logs',
        id: hl.id,
        columns: {
          id: hl.id,
          user_id: hl.userId,
          habit_id: hl.habitId,
          date: logDate,
          completed: typeof hl.completed === 'boolean' ? hl.completed : true,
          value: typeof hl.value === 'number' ? hl.value : 1.0,
          notes: hl.notes || null,
          created_at: hl.createdAt ? new Date(hl.createdAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: ['completed', 'value', 'notes'],
      });
      stats.habit_logs.mappedRows++;
    }

    // 5. Financial Transactions
    const transactions = data.transactions || [];
    stats.financial_transactions.foundInSource = transactions.length;
    for (const tx of transactions) {
      if (!tx.id || !tx.title || typeof tx.amount !== 'number') {
        stats.financial_transactions.invalid++;
        errors.push(`Transaction missing required fields (id, title, amount): ${JSON.stringify(tx)}`);
        continue;
      }
      if (!checkUserOwnership('Transaction', tx.id, tx.userId)) {
        stats.financial_transactions.invalid++;
        continue;
      }
      stats.financial_transactions.valid++;

      // Minor units calculation with precision safeguard
      const minorUnits = typeof tx.minorUnits === 'number'
        ? Math.round(tx.minorUnits)
        : Math.round(tx.amount * 100);
      const exactAmount = Number((minorUnits / 100).toFixed(2));
      const txDate = tx.date ? tx.date.substring(0, 10) : new Date().toISOString().substring(0, 10);

      rowsByTable.financial_transactions.push({
        table: 'financial_transactions',
        id: tx.id,
        columns: {
          id: tx.id,
          user_id: tx.userId,
          title: tx.title,
          amount: exactAmount,
          minor_units: minorUnits,
          currency: 'USD',
          type: tx.type === 'income' ? 'income' : 'expense',
          category: tx.category || 'General',
          date: txDate,
          payment_method: tx.paymentMethod || null,
          is_recurring: Boolean(tx.isRecurring),
          merchant_or_source: null,
          notes: tx.notes || null,
          tags: [],
          is_encrypted: Boolean(tx.isEncrypted),
          created_at: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
          updated_at: tx.updatedAt ? new Date(tx.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'title', 'amount', 'minor_units', 'type', 'category', 'date',
          'payment_method', 'is_recurring', 'notes', 'is_encrypted', 'updated_at'
        ],
      });
      stats.financial_transactions.mappedRows++;
    }

    // 6. Budgets
    const budgets = data.budgets || [];
    stats.budgets.foundInSource = budgets.length;
    for (const b of budgets) {
      if (!b.id || !b.category || typeof b.limitAmount !== 'number') {
        stats.budgets.invalid++;
        errors.push(`Budget missing required fields (id, category, limitAmount): ${JSON.stringify(b)}`);
        continue;
      }
      if (!checkUserOwnership('Budget', b.id, b.userId)) {
        stats.budgets.invalid++;
        continue;
      }
      stats.budgets.valid++;

      const limitMinorUnits = typeof b.limitMinorUnits === 'number'
        ? Math.round(b.limitMinorUnits)
        : Math.round(b.limitAmount * 100);
      const exactLimit = Number((limitMinorUnits / 100).toFixed(2));
      const alertThresh = typeof b.alertThresholdPercentage === 'number' ? b.alertThresholdPercentage : 80.0;

      rowsByTable.budgets.push({
        table: 'budgets',
        id: b.id,
        columns: {
          id: b.id,
          user_id: b.userId,
          category: b.category,
          limit_amount: exactLimit,
          limit_minor_units: limitMinorUnits,
          period: b.period || 'monthly',
          month_year: 'all',
          alert_threshold_percentage: alertThresh,
          created_at: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString(),
          updated_at: b.updatedAt ? new Date(b.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: ['limit_amount', 'limit_minor_units', 'period', 'alert_threshold_percentage', 'updated_at'],
      });
      stats.budgets.mappedRows++;
    }

    // 7. Reflections
    const reflections = data.reflections || [];
    stats.reflections.foundInSource = reflections.length;
    for (const r of reflections) {
      if (!r.id || !r.date) {
        stats.reflections.invalid++;
        errors.push(`Reflection missing required fields (id, date): ${JSON.stringify(r)}`);
        continue;
      }
      if (!checkUserOwnership('Reflection', r.id, r.userId)) {
        stats.reflections.invalid++;
        continue;
      }
      stats.reflections.valid++;

      const refDate = r.date.substring(0, 10);
      const energy = typeof r.energyLevel === 'number' ? Math.min(10, Math.max(1, r.energyLevel)) : 5;
      const clarity = typeof r.clarityLevel === 'number' ? Math.min(10, Math.max(1, r.clarityLevel)) : 5;
      const stress = typeof r.stressLevel === 'number' ? Math.min(10, Math.max(1, r.stressLevel)) : 5;

      rowsByTable.reflections.push({
        table: 'reflections',
        id: r.id,
        columns: {
          id: r.id,
          user_id: r.userId,
          date: refDate,
          energy_level: energy,
          clarity_level: clarity,
          stress_level: stress,
          mood: null,
          primary_emotion: r.primaryEmotion || 'neutral',
          journal_entry: r.journalEntry || null,
          reflection: null,
          wins: Array.isArray(r.wins) ? r.wins : [],
          gratitudes: Array.isArray(r.gratitudes) ? r.gratitudes : [],
          learnings: Array.isArray(r.learnings) ? r.learnings : [],
          tags: [],
          is_encrypted: Boolean(r.isEncrypted),
          created_at: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
          updated_at: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'energy_level', 'clarity_level', 'stress_level', 'primary_emotion',
          'journal_entry', 'wins', 'gratitudes', 'learnings', 'is_encrypted', 'updated_at'
        ],
      });
      stats.reflections.mappedRows++;
    }

    // 8. Relationships, Important Dates, and Contact Interactions
    const relationships = data.relationships || [];
    stats.relationships.foundInSource = relationships.length;
    for (const rel of relationships) {
      if (!rel.id || !rel.name) {
        stats.relationships.invalid++;
        errors.push(`Relationship missing required fields (id, name): ${JSON.stringify(rel)}`);
        continue;
      }
      if (!checkUserOwnership('Relationship', rel.id, rel.userId)) {
        stats.relationships.invalid++;
        continue;
      }
      knownRelationshipIds.add(rel.id);
      stats.relationships.valid++;

      const lastIntDate = rel.lastInteractionDate ? rel.lastInteractionDate.substring(0, 10) : null;
      const nextReminderDate = rel.nextDueReminderDate ? rel.nextDueReminderDate.substring(0, 10) : null;
      const cadence = typeof rel.cadenceDays === 'number' && rel.cadenceDays > 0 ? rel.cadenceDays : 30;

      rowsByTable.relationships.push({
        table: 'relationships',
        id: rel.id,
        columns: {
          id: rel.id,
          user_id: rel.userId,
          name: rel.name,
          relation_type: rel.relationType || 'friend',
          cadence_days: cadence,
          last_interaction_date: lastIntDate,
          next_due_reminder_date: nextReminderDate,
          notes: rel.notes || null,
          tags: [],
          is_encrypted: Boolean(rel.isEncrypted),
          created_at: rel.createdAt ? new Date(rel.createdAt).toISOString() : new Date().toISOString(),
          updated_at: rel.updatedAt ? new Date(rel.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'name', 'relation_type', 'cadence_days', 'last_interaction_date',
          'next_due_reminder_date', 'notes', 'is_encrypted', 'updated_at'
        ],
      });
      stats.relationships.mappedRows++;

      // Anniversaries / Important Dates
      if (Array.isArray(rel.anniversaries)) {
        stats.relationship_important_dates.foundInSource += rel.anniversaries.length;
        rel.anniversaries.forEach((ann, idx) => {
          if (!ann.label || !ann.date) {
            stats.relationship_important_dates.invalid++;
            return;
          }
          stats.relationship_important_dates.valid++;
          const dateId = `reldate_${rel.id}_${idx}`;
          rowsByTable.relationship_important_dates.push({
            table: 'relationship_important_dates',
            id: dateId,
            columns: {
              id: dateId,
              relationship_id: rel.id,
              user_id: rel.userId,
              label: ann.label,
              date: ann.date,
              recurring_yearly: true,
              created_at: rel.createdAt ? new Date(rel.createdAt).toISOString() : new Date().toISOString(),
            },
            conflictTarget: ['id'],
            updateColumns: ['label', 'date', 'recurring_yearly'],
          });
          stats.relationship_important_dates.mappedRows++;
        });
      }
    }

    const interactions = data.interactions || [];
    stats.contact_interactions.foundInSource = interactions.length;
    for (const ci of interactions) {
      if (!ci.id || !ci.contactId || !ci.date) {
        stats.contact_interactions.invalid++;
        errors.push(`Interaction missing required fields (id, contactId, date): ${JSON.stringify(ci)}`);
        continue;
      }
      if (!checkUserOwnership('ContactInteraction', ci.id, ci.userId)) {
        stats.contact_interactions.invalid++;
        continue;
      }
      if (!knownRelationshipIds.has(ci.contactId)) {
        warnings.push(`ContactInteraction [${ci.id}] references unknown contactId [${ci.contactId}], skipping.`);
        stats.contact_interactions.invalid++;
        continue;
      }
      stats.contact_interactions.valid++;

      const intDate = ci.date.substring(0, 10);
      rowsByTable.contact_interactions.push({
        table: 'contact_interactions',
        id: ci.id,
        columns: {
          id: ci.id,
          user_id: ci.userId,
          contact_id: ci.contactId,
          date: intDate,
          channel: ci.channel || 'message',
          notes: ci.notes || null,
          energy_impact: ci.energyImpact || null,
          created_at: ci.createdAt ? new Date(ci.createdAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: ['channel', 'notes', 'energy_impact', 'date'],
      });
      stats.contact_interactions.mappedRows++;
    }

    // 9. Notes & Note Folders
    const notes = data.notes || [];
    stats.notes.foundInSource = notes.length;
    for (const n of notes) {
      if (!n.id || typeof n.content !== 'string') {
        stats.notes.invalid++;
        errors.push(`Note missing required fields (id, content): ${JSON.stringify(n)}`);
        continue;
      }
      if (!checkUserOwnership('Note', n.id, n.userId)) {
        stats.notes.invalid++;
        continue;
      }
      stats.notes.valid++;

      const wordCount = n.content.trim() ? n.content.trim().split(/\s+/).length : 0;
      rowsByTable.notes.push({
        table: 'notes',
        id: n.id,
        columns: {
          id: n.id,
          user_id: n.userId,
          folder_id: null,
          linked_goal_id: null,
          linked_task_id: null,
          title: n.title || 'Untitled',
          content: n.content,
          plain_text_summary: n.content.substring(0, 200),
          tags: Array.isArray(n.tags) ? n.tags : [],
          is_pinned: Boolean(n.isPinned),
          is_archived: Boolean(n.isArchived),
          word_count: wordCount,
          linked_note_ids: Array.isArray(n.linkedNoteIds) ? n.linkedNoteIds : [],
          is_encrypted: Boolean(n.isEncrypted),
          created_at: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
          updated_at: n.updatedAt ? new Date(n.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'title', 'content', 'plain_text_summary', 'tags', 'is_pinned',
          'is_archived', 'word_count', 'linked_note_ids', 'is_encrypted', 'updated_at'
        ],
      });
      stats.notes.mappedRows++;
    }

    // 10. AI Memories
    const aiMemories = data.aiMemories || [];
    stats.ai_memories.foundInSource = aiMemories.length;
    for (const mem of aiMemories) {
      if (!mem.id || !mem.key || !mem.value) {
        stats.ai_memories.invalid++;
        errors.push(`AIMemory missing required fields (id, key, value): ${JSON.stringify(mem)}`);
        continue;
      }
      if (!checkUserOwnership('AIMemory', mem.id, mem.userId)) {
        stats.ai_memories.invalid++;
        continue;
      }
      stats.ai_memories.valid++;

      rowsByTable.ai_memories.push({
        table: 'ai_memories',
        id: mem.id,
        columns: {
          id: mem.id,
          user_id: mem.userId,
          key: mem.key,
          value: mem.value,
          category: mem.category || 'preference',
          created_at: mem.createdAt ? new Date(mem.createdAt).toISOString() : new Date().toISOString(),
          updated_at: mem.updatedAt ? new Date(mem.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: ['key', 'value', 'category', 'updated_at'],
      });
      stats.ai_memories.mappedRows++;
    }

    // 11. Audit Logs
    const auditLogs = data.auditLogs || [];
    stats.audit_logs.foundInSource = auditLogs.length;
    for (const al of auditLogs) {
      if (!al.id || !al.action || !al.resource) {
        stats.audit_logs.invalid++;
        errors.push(`AuditLog missing required fields (id, action, resource): ${JSON.stringify(al)}`);
        continue;
      }
      if (!checkUserOwnership('AuditLog', al.id, al.userId)) {
        stats.audit_logs.invalid++;
        continue;
      }
      stats.audit_logs.valid++;

      rowsByTable.audit_logs.push({
        table: 'audit_logs',
        id: al.id,
        columns: {
          id: al.id,
          user_id: al.userId,
          action: al.action,
          resource: al.resource,
          ip_address: al.ipAddress || null,
          user_agent: al.userAgent || null,
          metadata: al.metadata || null,
          timestamp: al.timestamp ? new Date(al.timestamp).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: ['action', 'resource', 'ip_address', 'user_agent', 'metadata', 'timestamp'],
      });
      stats.audit_logs.mappedRows++;
    }

    // 12. Password Reset Tokens
    const resetTokens = data.passwordResetTokens || [];
    stats.password_reset_tokens.foundInSource = resetTokens.length;
    for (const pr of resetTokens) {
      if (!pr.token || !pr.email || !pr.expiresAt) {
        stats.password_reset_tokens.invalid++;
        errors.push(`PasswordReset missing required fields (token, email, expiresAt): ${JSON.stringify(pr)}`);
        continue;
      }
      stats.password_reset_tokens.valid++;

      rowsByTable.password_reset_tokens.push({
        table: 'password_reset_tokens',
        id: pr.token,
        columns: {
          token: pr.token,
          email: pr.email,
          expires_at: new Date(pr.expiresAt).toISOString(),
          used: Boolean(pr.used),
          created_at: pr.createdAt ? new Date(pr.createdAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['token'],
        updateColumns: ['email', 'expires_at', 'used'],
      });
      stats.password_reset_tokens.mappedRows++;
    }

    // 13. Scheduled Notifications
    const scheduledNotifications = data.scheduledNotifications || [];
    stats.scheduled_notifications.foundInSource = scheduledNotifications.length;
    for (const sn of scheduledNotifications) {
      if (!sn.id || !sn.title || !sn.scheduledFor) {
        stats.scheduled_notifications.invalid++;
        errors.push(`ScheduledNotification missing required fields (id, title, scheduledFor): ${JSON.stringify(sn)}`);
        continue;
      }
      if (!checkUserOwnership('ScheduledNotification', sn.id, sn.userId)) {
        stats.scheduled_notifications.invalid++;
        continue;
      }
      knownSchedNotifIds.add(sn.id);
      stats.scheduled_notifications.valid++;

      rowsByTable.scheduled_notifications.push({
        table: 'scheduled_notifications',
        id: sn.id,
        columns: {
          id: sn.id,
          user_id: sn.userId,
          type: sn.type || 'custom_reminder',
          title: sn.title,
          message: sn.message || '',
          priority: sn.priority || 'medium',
          scheduled_for: new Date(sn.scheduledFor).toISOString(),
          status: sn.status || 'scheduled',
          delivered_at: sn.deliveredAt ? new Date(sn.deliveredAt).toISOString() : null,
          action_url: sn.actionUrl || null,
          entity_type: sn.entityReference?.type || null,
          entity_id: sn.entityReference?.id || null,
          metadata: sn.metadata || null,
          created_at: sn.createdAt ? new Date(sn.createdAt).toISOString() : new Date().toISOString(),
          updated_at: sn.updatedAt ? new Date(sn.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'type', 'title', 'message', 'priority', 'scheduled_for',
          'status', 'delivered_at', 'action_url', 'entity_type', 'entity_id', 'metadata', 'updated_at'
        ],
      });
      stats.scheduled_notifications.mappedRows++;
    }

    // 14. In-App Notifications
    const notifications = data.notifications || [];
    stats.notifications.foundInSource = notifications.length;
    for (const notif of notifications) {
      if (!notif.id || !notif.title) {
        stats.notifications.invalid++;
        errors.push(`Notification missing required fields (id, title): ${JSON.stringify(notif)}`);
        continue;
      }
      if (!checkUserOwnership('Notification', notif.id, notif.userId)) {
        stats.notifications.invalid++;
        continue;
      }
      stats.notifications.valid++;

      let validSchedId: string | null = null;
      if (notif.scheduledNotificationId) {
        if (knownSchedNotifIds.has(notif.scheduledNotificationId)) {
          validSchedId = notif.scheduledNotificationId;
        } else {
          warnings.push(`Notification [${notif.id}] references unknown scheduledNotificationId [${notif.scheduledNotificationId}], setting to NULL.`);
        }
      }

      rowsByTable.notifications.push({
        table: 'notifications',
        id: notif.id,
        columns: {
          id: notif.id,
          user_id: notif.userId,
          scheduled_notification_id: validSchedId,
          type: notif.type || 'system_alert',
          title: notif.title,
          message: notif.message || '',
          priority: notif.priority || 'medium',
          is_read: Boolean(notif.isRead),
          read_at: notif.readAt ? new Date(notif.readAt).toISOString() : null,
          action_url: notif.actionUrl || null,
          entity_type: notif.entityReference?.type || null,
          entity_id: notif.entityReference?.id || null,
          created_at: notif.createdAt ? new Date(notif.createdAt).toISOString() : new Date().toISOString(),
          updated_at: notif.updatedAt ? new Date(notif.updatedAt).toISOString() : new Date().toISOString(),
        },
        conflictTarget: ['id'],
        updateColumns: [
          'type', 'title', 'message', 'priority', 'is_read',
          'read_at', 'action_url', 'entity_type', 'entity_id', 'updated_at'
        ],
      });
      stats.notifications.mappedRows++;
    }

    // Topological dependency ordering for SQL insertion
    const orderedTables = [
      'users',
      'goals',
      'goal_milestones',
      'tasks',
      'task_subtasks',
      'habits',
      'habit_logs',
      'financial_transactions',
      'budgets',
      'reflections',
      'relationships',
      'relationship_important_dates',
      'contact_interactions',
      'note_folders',
      'notes',
      'ai_memories',
      'audit_logs',
      'password_reset_tokens',
      'scheduled_notifications',
      'notifications',
    ];

    const allRowsOrdered: MappedRow[] = [];
    let totalFound = 0;
    let totalMapped = 0;
    let totalInvalid = 0;

    for (const tbl of orderedTables) {
      const rows = rowsByTable[tbl] || [];
      allRowsOrdered.push(...rows);
      if (stats[tbl]) {
        totalFound += stats[tbl].foundInSource;
        totalMapped += stats[tbl].mappedRows;
        totalInvalid += stats[tbl].invalid;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    const report: MigrationReport = {
      success: errors.length === 0,
      totalFound,
      totalMapped,
      totalInvalid,
      entityStats: stats,
      errors,
      warnings,
      executionTimeMs,
    };

    return {
      orderedTables,
      rowsByTable,
      allRowsOrdered,
      report,
    };
  }

  /**
   * Generates raw SQL INSERT / UPSERT statements for all mapped rows in dependency order.
   */
  public static generateMigrationSql(plan: MigrationPlan): string {
    const statements: string[] = [
      '-- ORIGIN Data Migration Script (JSON -> PostgreSQL)',
      '-- Generated automatically by JsonToPostgresMigrator',
      'BEGIN;',
      '',
    ];

    for (const row of plan.allRowsOrdered) {
      const colNames = Object.keys(row.columns);
      const colList = colNames.map(escapeIdentifier).join(', ');
      const valList = colNames.map((c) => formatSqlValue(row.columns[c])).join(', ');

      let sql = `INSERT INTO ${escapeIdentifier(row.table)} (${colList})\nVALUES (${valList})`;

      if (row.conflictTarget && row.conflictTarget.length > 0) {
        const conflictCols = row.conflictTarget.map(escapeIdentifier).join(', ');
        if (row.updateColumns && row.updateColumns.length > 0) {
          const updates = row.updateColumns
            .map((c) => `${escapeIdentifier(c)} = EXCLUDED.${escapeIdentifier(c)}`)
            .join(', ');
          sql += `\nON CONFLICT (${conflictCols}) DO UPDATE SET ${updates};`;
        } else {
          sql += `\nON CONFLICT (${conflictCols}) DO NOTHING;`;
        }
      } else {
        sql += ';';
      }

      statements.push(sql);
    }

    statements.push('', 'COMMIT;');
    return statements.join('\n');
  }

  /**
   * Executes migration using an active database client/pool within a safe transaction.
   * If any step fails, automatically rolls back and outputs the exact failure details.
   */
  public static async executeMigration(
    db: DatabaseExecutor,
    plan: MigrationPlan
  ): Promise<{ success: boolean; rowsInserted: number; error?: string }> {
    if (!plan.report.success) {
      throw new Error(`Cannot execute migration due to plan errors: ${plan.report.errors.join('; ')}`);
    }

    let rowsInserted = 0;
    try {
      await db.query('BEGIN;');

      for (const row of plan.allRowsOrdered) {
        const colNames = Object.keys(row.columns);
        const colList = colNames.map(escapeIdentifier).join(', ');
        const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
        const values = colNames.map((c) => row.columns[c]);

        let sql = `INSERT INTO ${escapeIdentifier(row.table)} (${colList}) VALUES (${placeholders})`;

        if (row.conflictTarget && row.conflictTarget.length > 0) {
          const conflictCols = row.conflictTarget.map(escapeIdentifier).join(', ');
          if (row.updateColumns && row.updateColumns.length > 0) {
            const updates = row.updateColumns
              .map((c) => `${escapeIdentifier(c)} = EXCLUDED.${escapeIdentifier(c)}`)
              .join(', ');
            sql += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}`;
          } else {
            sql += ` ON CONFLICT (${conflictCols}) DO NOTHING`;
          }
        }

        await db.query(sql, values);
        rowsInserted++;
      }

      await db.query('COMMIT;');
      return { success: true, rowsInserted };
    } catch (err: any) {
      try {
        await db.query('ROLLBACK;');
      } catch (rollbackErr) {
        // preserve original error
      }
      return {
        success: false,
        rowsInserted: 0,
        error: `Migration transaction rolled back due to error: ${err?.message || String(err)}`,
      };
    }
  }
}
