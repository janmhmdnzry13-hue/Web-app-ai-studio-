import { describe, it, expect } from 'vitest';
import { JsonToPostgresMigrator, type DatabaseExecutor } from '../scripts/migrate_to_postgres.js';
import type { DatabaseSchema } from '../db.js';

describe('Safe JSON to PostgreSQL Migration Engine', () => {
  const sampleFixture: Partial<DatabaseSchema> = {
    version: 1,
    users: [
      {
        id: 'usr_alpha',
        email: 'alpha@origin-os.internal',
        passwordHash: '$2b$10$xyz',
        role: 'member',
        emailVerified: true,
        profile: { displayName: 'Alpha Tester', headline: 'Engineer' },
        preferences: {
          theme: 'system',
          timezone: 'UTC',
          locale: 'en-US',
          weekStartDay: 1,
          reducedMotion: false,
          compactDensity: false,
          dailyReflectionReminderTime: '21:00',
          notificationChannels: { inApp: true, email: true, dailyDigest: true },
          unlockedModules: ['tasks', 'habits', 'finances', 'goals'],
        },
        subscription: { tier: 'pro', status: 'active' },
        lastLoginAt: '2026-08-30T12:00:00.000Z',
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    goals: [
      {
        id: 'goal_alpha_1',
        userId: 'usr_alpha',
        title: 'Launch ORIGIN v1',
        category: 'career',
        horizon: 'quarterly',
        targetDate: '2026-12-31',
        progressPercentage: 45.5,
        status: 'active',
        milestones: [
          { id: 'mile_1', title: 'Complete DB Schema', completed: true, order: 1 },
          { id: 'mile_2', title: 'Data Migration Script', completed: true, order: 2 },
        ],
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    tasks: [
      {
        id: 'task_alpha_1',
        userId: 'usr_alpha',
        goalId: 'goal_alpha_1',
        title: 'Write test suite',
        priority: 'high',
        status: 'todo',
        dueDate: '2026-08-30T18:00:00.000Z',
        estimatedMinutes: 45,
        actualMinutes: null,
        tags: ['testing', 'backend'],
        subtasks: [
          { id: 'sub_1', title: 'Unit test mapping', completed: true },
          { id: 'sub_2', title: 'Idempotency test', completed: false },
        ],
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    habits: [
      {
        id: 'hbt_alpha_1',
        userId: 'usr_alpha',
        name: 'Deep Work',
        category: 'deep_work',
        frequency: 'daily',
        targetPerDay: 1,
        unit: 'session',
        streakCount: 7,
        bestStreak: 14,
        totalCompletions: 30,
        archived: false,
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    habitLogs: [
      {
        id: 'hbtlog_1',
        userId: 'usr_alpha',
        habitId: 'hbt_alpha_1',
        date: '2026-08-30',
        completed: true,
        value: 1,
        notes: 'Great 90m sprint',
        createdAt: '2026-08-30T11:00:00.000Z',
      },
    ],
    transactions: [
      {
        id: 'tx_alpha_1',
        userId: 'usr_alpha',
        title: 'Cloud Infrastructure',
        amount: 49.99,
        minorUnits: 4999,
        type: 'expense',
        category: 'Software & Dev',
        date: '2026-08-30',
        paymentMethod: 'Credit Card',
        isRecurring: true,
        notes: 'Monthly server instance',
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    budgets: [
      {
        id: 'bdg_alpha_1',
        userId: 'usr_alpha',
        category: 'Software & Dev',
        limitAmount: 200.0,
        limitMinorUnits: 20000,
        period: 'monthly',
        alertThresholdPercentage: 80,
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    reflections: [
      {
        id: 'refl_alpha_1',
        userId: 'usr_alpha',
        date: '2026-08-30',
        energyLevel: 8,
        clarityLevel: 9,
        stressLevel: 3,
        primaryEmotion: 'energized',
        journalEntry: 'Great execution today.',
        wins: ['Completed migration engine'],
        gratitudes: ['High focus'],
        learnings: ['PostgreSQL strict schemas provide robust invariants'],
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    relationships: [
      {
        id: 'rel_alpha_1',
        userId: 'usr_alpha',
        name: 'Sarah Connor',
        relationType: 'colleague',
        cadenceDays: 14,
        lastInteractionDate: '2026-08-25',
        nextDueReminderDate: '2026-09-08',
        anniversaries: [{ label: 'Work Anniversary', date: '08-15' }],
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    interactions: [
      {
        id: 'int_alpha_1',
        userId: 'usr_alpha',
        contactId: 'rel_alpha_1',
        date: '2026-08-25',
        channel: 'video',
        notes: 'Sprint planning sync',
        energyImpact: 'energizing',
        createdAt: '2026-08-25T14:00:00.000Z',
      },
    ],
    notes: [
      {
        id: 'note_alpha_1',
        userId: 'usr_alpha',
        title: 'System Architecture Notes',
        content: 'PostgreSQL provides ACID guarantees and structured relational modeling.',
        tags: ['architecture', 'db'],
        isPinned: true,
        isArchived: false,
        linkedNoteIds: [],
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    aiMemories: [
      {
        id: 'mem_alpha_1',
        userId: 'usr_alpha',
        key: 'preferred_focus_time',
        value: 'Mornings from 8am to 11am',
        category: 'routine',
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    auditLogs: [
      {
        id: 'aud_alpha_1',
        userId: 'usr_alpha',
        action: 'USER_LOGIN',
        resource: 'auth',
        ipAddress: '127.0.0.1',
        timestamp: '2026-08-30T10:00:00.000Z',
      },
    ],
    passwordResetTokens: [
      {
        token: 'rst_token_123',
        email: 'alpha@origin-os.internal',
        expiresAt: '2026-08-30T11:00:00.000Z',
        used: false,
        createdAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    scheduledNotifications: [
      {
        id: 'sched_notif_1',
        userId: 'usr_alpha',
        type: 'task_reminder',
        title: 'Review Task',
        message: 'Your task is due today.',
        priority: 'high',
        scheduledFor: '2026-08-30T18:00:00.000Z',
        status: 'scheduled',
        entityReference: { type: 'task', id: 'task_alpha_1' },
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
    notifications: [
      {
        id: 'notif_alpha_1',
        userId: 'usr_alpha',
        scheduledNotificationId: 'sched_notif_1',
        type: 'task_reminder',
        title: 'Review Task',
        message: 'Your task is due today.',
        priority: 'high',
        isRead: false,
        entityReference: { type: 'task', id: 'task_alpha_1' },
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      },
    ],
  };

  it('correctly maps and preserves all entity IDs, relationships, and financial precision', () => {
    const plan = JsonToPostgresMigrator.planMigration(sampleFixture);

    expect(plan.report.success).toBe(true);
    expect(plan.report.errors.length).toBe(0);

    // Verify User mapping
    const userRow = plan.rowsByTable.users.find((r) => r.id === 'usr_alpha');
    expect(userRow).toBeDefined();
    expect(userRow?.columns.id).toBe('usr_alpha');
    expect(userRow?.columns.email).toBe('alpha@origin-os.internal');
    expect(userRow?.columns.display_name).toBe('Alpha Tester');
    expect(userRow?.columns.subscription_tier).toBe('pro');

    // Verify Goal & Milestone mapping & ID preservation
    const goalRow = plan.rowsByTable.goals.find((r) => r.id === 'goal_alpha_1');
    expect(goalRow?.columns.user_id).toBe('usr_alpha');
    expect(goalRow?.columns.progress_percentage).toBe(45.5);

    const milestoneRows = plan.rowsByTable.goal_milestones.filter((r) => r.columns.goal_id === 'goal_alpha_1');
    expect(milestoneRows.length).toBe(2);
    expect(milestoneRows[0].id).toBe('mile_1');
    expect(milestoneRows[0].columns.user_id).toBe('usr_alpha');

    // Verify Task & Subtask mapping
    const taskRow = plan.rowsByTable.tasks.find((r) => r.id === 'task_alpha_1');
    expect(taskRow?.columns.user_id).toBe('usr_alpha');
    expect(taskRow?.columns.goal_id).toBe('goal_alpha_1');
    expect(taskRow?.columns.estimated_minutes).toBe(45);

    const subtaskRows = plan.rowsByTable.task_subtasks.filter((r) => r.columns.task_id === 'task_alpha_1');
    expect(subtaskRows.length).toBe(2);
    expect(subtaskRows[0].columns.title).toBe('Unit test mapping');

    // Verify Financial minor_units integer precision & amount
    const txRow = plan.rowsByTable.financial_transactions.find((r) => r.id === 'tx_alpha_1');
    expect(txRow?.columns.amount).toBe(49.99);
    expect(txRow?.columns.minor_units).toBe(4999);
    expect(txRow?.columns.currency).toBe('USD');

    // Verify Notifications and Scheduled Notifications relation
    const notifRow = plan.rowsByTable.notifications.find((r) => r.id === 'notif_alpha_1');
    expect(notifRow?.columns.scheduled_notification_id).toBe('sched_notif_1');
    expect(notifRow?.columns.user_id).toBe('usr_alpha');
  });

  it('generates valid idempotent SQL statements with ON CONFLICT clauses', () => {
    const plan = JsonToPostgresMigrator.planMigration(sampleFixture);
    const sql = JsonToPostgresMigrator.generateMigrationSql(plan);

    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain('INSERT INTO "users"');
    expect(sql).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(sql).toContain('INSERT INTO "financial_transactions"');
    expect(sql).toContain('ON CONFLICT ("id") DO UPDATE SET');
  });

  it('handles and reports invalid records or missing foreign keys cleanly', () => {
    const invalidFixture: Partial<DatabaseSchema> = {
      users: [
        {
          id: '',
          email: 'broken@test.internal',
          passwordHash: 'hash',
          role: 'member',
          emailVerified: true,
          profile: { displayName: 'Broken' },
          preferences: {
            theme: 'system',
            timezone: 'UTC',
            locale: 'en-US',
            weekStartDay: 1,
            reducedMotion: false,
            compactDensity: false,
            dailyReflectionReminderTime: null,
            notificationChannels: { inApp: true, email: true, dailyDigest: true },
          },
          lastLoginAt: null,
          createdAt: '2026-08-30T10:00:00.000Z',
          updatedAt: '2026-08-30T10:00:00.000Z',
        },
      ],
      tasks: [
        {
          id: 'tsk_orphan',
          userId: 'non_existent_user',
          title: 'Orphan task',
          priority: 'low',
          status: 'todo',
          tags: [],
          subtasks: [],
          createdAt: '2026-08-30T10:00:00.000Z',
          updatedAt: '2026-08-30T10:00:00.000Z',
        },
      ],
    };

    const plan = JsonToPostgresMigrator.planMigration(invalidFixture);
    expect(plan.report.success).toBe(false);
    expect(plan.report.errors.some((e) => e.includes('Invalid user record'))).toBe(true);
    expect(plan.report.warnings.some((w) => w.includes('references non-existent userId'))).toBe(true);
  });

  it('simulates transactional execution and rollback safety upon database failure', async () => {
    const plan = JsonToPostgresMigrator.planMigration(sampleFixture);

    const executedQueries: string[] = [];
    const mockDb: DatabaseExecutor = {
      query: async (queryText: string) => {
        executedQueries.push(queryText);
        if (queryText.includes('INSERT INTO "reflections"')) {
          throw new Error('Simulated database write constraint violation');
        }
        return { rows: [] };
      },
    };

    const result = await JsonToPostgresMigrator.executeMigration(mockDb, plan);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Migration transaction rolled back');
    expect(executedQueries).toContain('BEGIN;');
    expect(executedQueries).toContain('ROLLBACK;');
  });

  it('runs against real origin_db.json and verifies full integrity without errors', () => {
    const realDb = JsonToPostgresMigrator.readJsonDb();
    const plan = JsonToPostgresMigrator.planMigration(realDb);

    expect(plan.report.success).toBe(true);
    expect(plan.report.errors.length).toBe(0);
    expect(plan.report.totalFound).toBeGreaterThan(0);
    expect(plan.report.totalMapped).toBeGreaterThan(0);
    expect(plan.allRowsOrdered.length).toBe(plan.report.totalMapped);
  });
});
