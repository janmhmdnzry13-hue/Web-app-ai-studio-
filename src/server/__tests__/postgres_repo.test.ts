import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb, IMemoryDb, DataType } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { setDbPoolForTesting, closeDbPool } from '../db/postgres';
import {
  createPostgresRepositoryContainer,
  setStorageEngineForTesting,
  setRepositoriesForTesting,
  resetRepositories,
  getActiveRepositories,
  userRepository,
  taskRepository,
  habitRepository,
  habitLogRepository,
  goalRepository,
  transactionRepository,
  budgetRepository,
  reflectionRepository,
  relationshipRepository,
  interactionRepository,
  noteRepository,
  aiMemoryRepository,
  auditLogRepository,
  passwordResetRepository,
  notificationRepository,
  scheduledNotificationRepository,
} from '../repositories';

describe('PostgreSQL Repository Layer & Integration Test Suite', () => {
  let memDb: IMemoryDb;
  let testPool: any;

  beforeEach(() => {
    // 1. Create clean isolated in-memory PostgreSQL instance
    memDb = newDb();

    // Register pg functions / extensions if needed
    memDb.public.registerFunction({
      name: 'current_database',
      args: [],
      returns: DataType.text,
      implementation: () => 'origin_test_db',
    });

    memDb.public.registerFunction({
      name: 'uuid_generate_v4',
      args: [],
      returns: DataType.text,
      implementation: () => '00000000-0000-4000-8000-000000000000',
    });

    // 2. Load and execute official PostgreSQL schema DDL
    const schemaSqlPath = path.join(process.cwd(), 'src/server/db/schema.sql');
    let schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    // Strip CREATE EXTENSION statements which are PostgreSQL system level in real DBs
    schemaSql = schemaSql.replace(/CREATE EXTENSION[^\n;]*;/gi, '');
    memDb.public.none(schemaSql);

    // 3. Create pg Pool adapter connected to the isolated test database
    const pgAdapter = memDb.adapters.createPg();
    testPool = new pgAdapter.Pool();

    // 4. Inject test pool and switch active engine to postgres
    setDbPoolForTesting(testPool);
    setStorageEngineForTesting('postgres');
    resetRepositories();
  });

  afterEach(async () => {
    resetRepositories();
    await closeDbPool();
  });

  it('1. Create & Read: Successfully creates and retrieves users, tasks, habits, and goals with exact IDs', async () => {
    const repos = createPostgresRepositoryContainer();

    // Create User
    const user = await repos.users.create({
      id: 'usr_test_alpha',
      email: 'alpha@origin.test',
      passwordHash: '$2b$10$hashedpw',
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Alpha Tester',
        headline: 'Principal Systems Architect',
        bio: 'Building deliberate systems.',
      },
      preferences: {
        theme: 'dark',
        timezone: 'America/New_York',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: true,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: ['tasks', 'habits', 'finances', 'goals'],
      },
      subscription: {
        tier: 'pro',
        status: 'active',
      },
      lastLoginAt: null,
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T10:00:00.000Z',
    });

    expect(user.id).toBe('usr_test_alpha');
    expect(user.email).toBe('alpha@origin.test');
    expect(user.profile.displayName).toBe('Alpha Tester');
    expect(user.preferences.theme).toBe('dark');
    expect(user.subscription?.tier).toBe('pro');

    // Read by ID
    const foundUser = await repos.users.findById('usr_test_alpha');
    expect(foundUser).not.toBeNull();
    expect(foundUser?.id).toBe('usr_test_alpha');

    // Read by Email
    const foundByEmail = await repos.users.findByEmail('ALPHA@origin.test');
    expect(foundByEmail).not.toBeNull();
    expect(foundByEmail?.id).toBe('usr_test_alpha');

    // Create Task with Subtasks
    const task = await repos.tasks.create({
      id: 'task_alpha_001',
      userId: 'usr_test_alpha',
      title: 'Deploy PostgreSQL Layer',
      description: 'Zero-downtime database integration test',
      priority: 'urgent',
      status: 'in_progress',
      dueDate: '2026-08-30',
      estimatedMinutes: 60,
      actualMinutes: 30,
      tags: ['database', 'architecture'],
      subtasks: [
        { id: 'sub_1', title: 'Write tests', completed: true },
        { id: 'sub_2', title: 'Verify parameterization', completed: false },
      ],
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T10:00:00.000Z',
    });

    expect(task.id).toBe('task_alpha_001');
    expect(task.userId).toBe('usr_test_alpha');
    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0].completed).toBe(true);
    expect(task.subtasks[1].completed).toBe(false);

    // Read Task by ID
    const foundTask = await repos.tasks.findById('task_alpha_001', 'usr_test_alpha');
    expect(foundTask).not.toBeNull();
    expect(foundTask?.title).toBe('Deploy PostgreSQL Layer');
    expect(foundTask?.subtasks).toHaveLength(2);
  });

  it('2. Update: Accurately updates records and manages subtasks / milestones', async () => {
    const repos = createPostgresRepositoryContainer();

    // Create User & Task
    await repos.users.create({
      id: 'usr_update_test',
      email: 'update@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Original Name' },
      preferences: {
        theme: 'light',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update Profile
    const updatedUser = await repos.users.updateProfile('usr_update_test', {
      displayName: 'Updated Name',
      headline: 'Senior Lead',
    });
    expect(updatedUser?.profile.displayName).toBe('Updated Name');
    expect(updatedUser?.profile.headline).toBe('Senior Lead');

    // Create Goal
    const goal = await repos.goals.create({
      id: 'goal_001',
      userId: 'usr_update_test',
      title: 'Initial Goal Title',
      category: 'career',
      horizon: 'annual',
      targetDate: '2026-12-31',
      progressPercentage: 20,
      status: 'active',
      milestones: [{ id: 'm_1', title: 'Step 1', completed: true, order: 1 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update Goal with new progress and updated milestones
    const updatedGoal = await repos.goals.update('goal_001', 'usr_update_test', {
      title: 'Upgraded Goal Title',
      progressPercentage: 80,
      milestones: [
        { id: 'm_1', title: 'Step 1', completed: true, order: 1 },
        { id: 'm_2', title: 'Step 2', completed: true, order: 2 },
      ],
    });

    expect(updatedGoal?.title).toBe('Upgraded Goal Title');
    expect(updatedGoal?.progressPercentage).toBe(80);
    expect(updatedGoal?.milestones).toHaveLength(2);
  });

  it('3. Delete & Cascading Foreign Keys: Deleting a parent user or entity cascades appropriately', async () => {
    const repos = createPostgresRepositoryContainer();

    await repos.users.create({
      id: 'usr_to_delete',
      email: 'delete_me@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Disposable User' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repos.tasks.create({
      id: 'task_cascade_1',
      userId: 'usr_to_delete',
      title: 'Child Task',
      priority: 'low',
      status: 'todo',
      tags: [],
      subtasks: [{ id: 'sub_c_1', title: 'Child Subtask', completed: false }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Delete single task
    const taskDeleted = await repos.tasks.delete('task_cascade_1', 'usr_to_delete');
    expect(taskDeleted).toBe(true);

    const taskLookup = await repos.tasks.findById('task_cascade_1', 'usr_to_delete');
    expect(taskLookup).toBeNull();

    // Create another task & habit
    await repos.tasks.create({
      id: 'task_cascade_2',
      userId: 'usr_to_delete',
      title: 'Second Child Task',
      priority: 'low',
      status: 'todo',
      tags: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repos.habits.create({
      id: 'habit_cascade_1',
      userId: 'usr_to_delete',
      name: 'Daily Reading',
      category: 'learning',
      frequency: 'daily',
      targetPerDay: 1,
      streakCount: 3,
      bestStreak: 10,
      totalCompletions: 15,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Delete user -> triggers ON DELETE CASCADE across all tables
    const userDeleted = await repos.users.delete('usr_to_delete');
    expect(userDeleted).toBe(true);

    const remainingTasks = await repos.tasks.findByUserId('usr_to_delete');
    expect(remainingTasks).toHaveLength(0);

    const remainingHabits = await repos.habits.findByUserId('usr_to_delete');
    expect(remainingHabits).toHaveLength(0);
  });

  it('4. Strict Tenant Isolation: User A cannot read, modify, or delete User B records', async () => {
    const repos = createPostgresRepositoryContainer();

    // Seed User A and User B
    await repos.users.create({
      id: 'usr_alice',
      email: 'alice@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Alice' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repos.users.create({
      id: 'usr_bob',
      email: 'bob@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Bob' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create Alice's private note & transaction
    await repos.notes.create({
      id: 'note_alice_secret',
      userId: 'usr_alice',
      title: "Alice's Private Thoughts",
      content: 'Confidential strategic roadmap.',
      tags: ['secret'],
      isPinned: true,
      isArchived: false,
      linkedNoteIds: [],
      isEncrypted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repos.transactions.create({
      id: 'tx_alice_private',
      userId: 'usr_alice',
      title: 'Consulting Income',
      amount: 5000,
      minorUnits: 500000,
      type: 'income',
      category: 'Professional',
      date: '2026-08-30',
      isRecurring: false,
      isEncrypted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Bob attempts to find Alice's note
    const bobNoteLookup = await repos.notes.findById('note_alice_secret', 'usr_bob');
    expect(bobNoteLookup).toBeNull();

    // Bob queries all notes for Bob
    const bobNotes = await repos.notes.findByUserId('usr_bob');
    expect(bobNotes).toHaveLength(0);

    // Bob attempts to update Alice's note
    const bobUpdateAttempt = await repos.notes.update('note_alice_secret', 'usr_bob', {
      title: 'Hacked Title',
    });
    expect(bobUpdateAttempt).toBeNull();

    // Bob attempts to delete Alice's transaction
    const bobDeleteTx = await repos.transactions.delete('tx_alice_private', 'usr_bob');
    expect(bobDeleteTx).toBe(false);

    // Verify Alice's transaction is completely intact
    const aliceTx = await repos.transactions.findById('tx_alice_private', 'usr_alice');
    expect(aliceTx).not.toBeNull();
    expect(aliceTx?.amount).toBe(5000);
  });

  it('5. SQL Injection Prevention: Parameterized queries safely store malicious payloads as literal text', async () => {
    const repos = createPostgresRepositoryContainer();

    await repos.users.create({
      id: 'usr_sec_test',
      email: 'sec@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: "Robert'); DROP TABLE tasks; --" },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create a task with SQL injection strings in title and description
    const maliciousTask = await repos.tasks.create({
      id: "task_sqli_1' OR '1'='1",
      userId: 'usr_sec_test',
      title: "'; DROP TABLE tasks; SELECT * FROM users WHERE 'a'='a",
      description: "Robert'); DROP TABLE habits; --",
      priority: 'high',
      status: 'todo',
      tags: ["tag'--", "tag'); DROP TABLE notes;--"],
      subtasks: [{ id: "sub_1';--", title: "Subtask'); DROP TABLE task_subtasks;--", completed: false }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(maliciousTask.id).toBe("task_sqli_1' OR '1'='1");
    expect(maliciousTask.title).toBe("'; DROP TABLE tasks; SELECT * FROM users WHERE 'a'='a");

    // Verify tasks and habits tables still exist and are completely intact
    const allTasks = await repos.tasks.findByUserId('usr_sec_test');
    expect(allTasks).toHaveLength(1);
    expect(allTasks[0].title).toBe("'; DROP TABLE tasks; SELECT * FROM users WHERE 'a'='a");
  });

  it('6. Habit Logging & Streak Calculation: Correctly logs habits and updates streak metrics', async () => {
    const repos = createPostgresRepositoryContainer();

    await repos.users.create({
      id: 'usr_habit_streak',
      email: 'habits@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Habit Master' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repos.habits.create({
      id: 'habit_streak_1',
      userId: 'usr_habit_streak',
      name: 'Hydration 2L',
      category: 'health',
      frequency: 'daily',
      targetPerDay: 1,
      streakCount: 0,
      bestStreak: 0,
      totalCompletions: 0,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Log completion on Day 1
    const resultDay1 = await repos.habitLogs.logHabit('usr_habit_streak', 'habit_streak_1', {
      date: '2026-08-29',
      completed: true,
      value: 1,
      notes: 'Drank 2L water',
    });

    expect(resultDay1).not.toBeNull();
    expect(resultDay1?.log.completed).toBe(true);
    expect(resultDay1?.habit.totalCompletions).toBe(1);
    expect(resultDay1?.habit.streakCount).toBe(1);
    expect(resultDay1?.habit.bestStreak).toBe(1);

    // Log completion on Day 2
    const resultDay2 = await repos.habitLogs.logHabit('usr_habit_streak', 'habit_streak_1', {
      date: '2026-08-30',
      completed: true,
      value: 1,
    });

    expect(resultDay2?.habit.totalCompletions).toBe(2);
    expect(resultDay2?.habit.streakCount).toBe(2);
    expect(resultDay2?.habit.bestStreak).toBe(2);
  });

  it('7. Financial Summaries: Correctly computes monthly income, expenses, and net balance', async () => {
    const repos = createPostgresRepositoryContainer();

    await repos.users.create({
      id: 'usr_fin_test',
      email: 'fin@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Finance User' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Income
    await repos.transactions.create({
      id: 'tx_inc_1',
      userId: 'usr_fin_test',
      title: 'Salary',
      amount: 4500.5,
      minorUnits: 450050,
      type: 'income',
      category: 'Career',
      date: `${currentMonthPrefix}-01`,
      isRecurring: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Expenses
    await repos.transactions.create({
      id: 'tx_exp_1',
      userId: 'usr_fin_test',
      title: 'Rent',
      amount: 1500.0,
      minorUnits: 150000,
      type: 'expense',
      category: 'Housing',
      date: `${currentMonthPrefix}-05`,
      isRecurring: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repos.transactions.create({
      id: 'tx_exp_2',
      userId: 'usr_fin_test',
      title: 'Groceries',
      amount: 350.25,
      minorUnits: 35025,
      type: 'expense',
      category: 'Food',
      date: `${currentMonthPrefix}-10`,
      isRecurring: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const summary = await repos.transactions.getSummary('usr_fin_test');
    expect(summary.monthlyIncome).toBe(4500.5);
    expect(summary.monthlyExpenses).toBe(1850.25);
    expect(summary.netBalance).toBe(2650.25);
    expect(summary.byCategory?.['Housing']).toBe(1500.0);
    expect(summary.byCategory?.['Food']).toBe(350.25);
  });

  it('8. Reflections Upsert: Upserts daily reflections safely with energy metrics and gratitude lists', async () => {
    const repos = createPostgresRepositoryContainer();

    await repos.users.create({
      id: 'usr_ref_test',
      email: 'ref@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Reflection User' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // First upsert on date
    const ref1 = await repos.reflections.upsert('usr_ref_test', '2026-08-30', {
      energyLevel: 8,
      clarityLevel: 9,
      stressLevel: 2,
      primaryEmotion: 'focused',
      journalEntry: 'Great day of clean architectural execution.',
      wins: ['Finished test suite', 'Solid architecture'],
      gratitudes: ['High mental clarity', 'Good health'],
    });

    expect(ref1.date).toBe('2026-08-30');
    expect(ref1.energyLevel).toBe(8);
    expect(ref1.wins).toEqual(['Finished test suite', 'Solid architecture']);
    expect(ref1.journalEntry).toBe('Great day of clean architectural execution.');

    // Second upsert on same date -> updates existing record without duplicate ID
    const ref2 = await repos.reflections.upsert('usr_ref_test', '2026-08-30', {
      clarityLevel: 10,
      journalEntry: 'Updated reflection note.',
    });

    expect(ref2.id).toBe(ref1.id);
    expect(ref2.clarityLevel).toBe(10);
    expect(ref2.energyLevel).toBe(8); // Preserved previous value
    expect(ref2.journalEntry).toBe('Updated reflection note.');
  });

  it('9. Notifications & Scheduled Delivery: Correctly queues and manages notifications', async () => {
    const repos = createPostgresRepositoryContainer();

    await repos.users.create({
      id: 'usr_notif_test',
      email: 'notif@origin.test',
      passwordHash: '$2b$10$hash',
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Notification User' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: [],
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create Notification
    const notif = await repos.notifications.create({
      id: 'notif_001',
      userId: 'usr_notif_test',
      type: 'task_reminder',
      title: 'Task Due Soon',
      message: 'Your deep work session begins in 10 minutes.',
      priority: 'high',
      isRead: false,
      readAt: null,
      actionUrl: '/app/tasks',
      entityReference: { type: 'task', id: 'task_xyz' },
      scheduledNotificationId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(notif.id).toBe('notif_001');
    expect(notif.isRead).toBe(false);

    // Check Unread count
    const unreadCount = await repos.notifications.countUnreadByUserId('usr_notif_test');
    expect(unreadCount).toBe(1);

    // Mark as read
    const readResult = await repos.notifications.markAsRead('notif_001', 'usr_notif_test');
    expect(readResult?.isRead).toBe(true);

    const updatedUnreadCount = await repos.notifications.countUnreadByUserId('usr_notif_test');
    expect(updatedUnreadCount).toBe(0);
  });

  it('10. Fail-Fast Production Policy: In production, missing PostgreSQL throws an explicit error and refuses silent JSON fallback', async () => {
    // Simulate production environment
    const originalEnv = process.env.NODE_ENV;
    const originalDbUrl = process.env.DATABASE_URL;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;
      delete process.env.PGHOST;
      delete process.env.PGDATABASE;

      // Remove test pool override
      setDbPoolForTesting(null);
      setStorageEngineForTesting(null);
      resetRepositories();

      // Expect attempting to get active repositories to throw a descriptive error
      expect(() => getActiveRepositories()).toThrowError(
        /CRITICAL_DATABASE_ERROR: PostgreSQL connection/i
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      }
      setDbPoolForTesting(testPool);
      setStorageEngineForTesting('postgres');
      resetRepositories();
    }
  });
});
