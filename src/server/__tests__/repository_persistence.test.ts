import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db, UserRecord, TaskRecord, HabitRecord, GoalRecord, TransactionRecord, NoteRecord } from '../db';
import {
  repositories,
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
import { apiRouter } from '../routes';
import { generateToken, hashPassword } from '../auth';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Repository Persistence & Data Access Abstraction Layer', () => {
  const testUserAId = 'usr_repo_test_user_a';
  const testUserBId = 'usr_repo_test_user_b';

  const userA: UserRecord = {
    id: testUserAId,
    email: 'usera@origin.test',
    passwordHash: hashPassword('Password123!'),
    role: 'member',
    emailVerified: true,
    profile: {
      displayName: 'User Alpha',
      headline: 'Architect',
      bio: 'Focused',
      primaryLifeFocus: 'Intentional Living',
    },
    preferences: {
      theme: 'dark',
      timezone: 'UTC',
      locale: 'en-US',
      weekStartDay: 1,
      reducedMotion: false,
      compactDensity: false,
      dailyReflectionReminderTime: '21:00',
      notificationChannels: { inApp: true, email: false, dailyDigest: true },
      unlockedModules: ['tasks', 'habits', 'finances', 'goals'],
    },
    subscription: { tier: 'pro', status: 'active' },
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const userB: UserRecord = {
    id: testUserBId,
    email: 'userb@origin.test',
    passwordHash: hashPassword('Password123!'),
    role: 'member',
    emailVerified: true,
    profile: {
      displayName: 'User Beta',
      headline: 'Designer',
      bio: 'Creating',
      primaryLifeFocus: 'Design Systems',
    },
    preferences: {
      theme: 'light',
      timezone: 'America/New_York',
      locale: 'en-US',
      weekStartDay: 0,
      reducedMotion: false,
      compactDensity: true,
      dailyReflectionReminderTime: '22:00',
      notificationChannels: { inApp: true, email: true, dailyDigest: false },
      unlockedModules: ['tasks', 'habits'],
    },
    subscription: { tier: 'free', status: 'active' },
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    // Reset in-memory database to a clean testing state
    db.schema.users = [{ ...userA }, { ...userB }];
    db.schema.tasks = [];
    db.schema.habits = [];
    db.schema.habitLogs = [];
    db.schema.goals = [];
    db.schema.transactions = [];
    db.schema.budgets = [];
    db.schema.reflections = [];
    db.schema.relationships = [];
    db.schema.interactions = [];
    db.schema.notes = [];
    db.schema.aiMemories = [];
    db.schema.auditLogs = [];
    db.schema.passwordResetTokens = [];
    db.schema.notifications = [];
    db.schema.scheduledNotifications = [];
    await db.save();

    tokenA = generateToken(userA);
    tokenB = generateToken(userB);
  });

  describe('1. CRUD Operations Through Repository Layer', () => {
    it('performs full CRUD lifecycle on Users via UserRepository', async () => {
      // Find by ID and Email
      const foundById = await userRepository.findById(testUserAId);
      expect(foundById).not.toBeNull();
      expect(foundById?.email).toBe('usera@origin.test');

      const foundByEmail = await userRepository.findByEmail('USERA@ORIGIN.TEST');
      expect(foundByEmail?.id).toBe(testUserAId);

      // Update Profile & Preferences
      const updated = await userRepository.updateProfile(testUserAId, { displayName: 'Alpha Prime' });
      expect(updated?.profile.displayName).toBe('Alpha Prime');

      const updatedPrefs = await userRepository.updatePreferences(testUserAId, { theme: 'light' });
      expect(updatedPrefs?.preferences.theme).toBe('light');

      // Direct schema inspection proves persistence without exposing internal structure to caller
      expect(db.schema.users.find((u) => u.id === testUserAId)?.profile.displayName).toBe('Alpha Prime');
    });

    it('performs full CRUD lifecycle on Tasks via TaskRepository', async () => {
      // Create
      const created = await taskRepository.create({
        id: 'tsk_101',
        userId: testUserAId,
        title: 'Review System Architecture',
        description: 'Verify repository layer abstraction',
        priority: 'urgent',
        status: 'todo',
        dueDate: '2026-09-01',
        scheduledTime: null,
        estimatedMinutes: 60,
        actualMinutes: null,
        tags: ['backend', 'core'],
        goalId: null,
        subtasks: [{ id: 'sub_1', title: 'Write tests', completed: false }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(created.id).toBe('tsk_101');

      // Read
      const list = await taskRepository.findByUserId(testUserAId);
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('Review System Architecture');

      // Update
      const updated = await taskRepository.update('tsk_101', testUserAId, { title: 'Updated Title' });
      expect(updated?.title).toBe('Updated Title');

      // Update Status
      const statusUpdated = await taskRepository.updateStatus('tsk_101', testUserAId, 'completed');
      expect(statusUpdated?.status).toBe('completed');

      // Delete
      const deleted = await taskRepository.delete('tsk_101', testUserAId);
      expect(deleted).toBe(true);
      const afterDelete = await taskRepository.findByUserId(testUserAId);
      expect(afterDelete.length).toBe(0);
    });

    it('performs full CRUD lifecycle on Habits & Logs via repositories', async () => {
      const habit = await habitRepository.create({
        id: 'hbt_101',
        userId: testUserAId,
        name: 'Deep Work Block',
        description: '90m focus session',
        category: 'deep_work',
        frequency: 'daily',
        targetDays: [1, 2, 3, 4, 5],
        targetPerDay: 1,
        reminderTime: '09:00',
        streakCount: 0,
        bestStreak: 0,
        totalCompletions: 0,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(habit.id).toBe('hbt_101');

      // Log habit
      const logResult = await habitLogRepository.logHabit(testUserAId, 'hbt_101', {
        date: '2026-08-30',
        completed: true,
        value: 1,
        notes: 'Great focus',
      });
      expect(logResult).not.toBeNull();
      expect(logResult?.habit.totalCompletions).toBe(1);
      expect(logResult?.habit.streakCount).toBe(1);

      // Verify active count
      const activeCount = await habitRepository.countActiveByUserId(testUserAId);
      expect(activeCount).toBe(1);
    });

    it('performs full CRUD lifecycle on Goals via GoalRepository', async () => {
      const goal = await goalRepository.create({
        id: 'gol_101',
        userId: testUserAId,
        title: 'Launch Repository Refactoring',
        description: 'Complete data layer abstraction',
        category: 'career',
        horizon: 'quarterly',
        targetDate: '2026-10-01',
        progressPercentage: 50,
        status: 'active',
        milestones: [{ id: 'm1', title: 'Design interfaces', completed: true, order: 1 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(goal.id).toBe('gol_101');

      const goals = await goalRepository.findByUserId(testUserAId);
      expect(goals.length).toBe(1);
      expect(goals[0].title).toBe('Launch Repository Refactoring');

      const count = await goalRepository.countActiveByUserId(testUserAId);
      expect(count).toBe(1);
    });

    it('performs full CRUD lifecycle on Finances & Summaries via TransactionRepository & BudgetRepository', async () => {
      await transactionRepository.create({
        id: 'tx_1',
        userId: testUserAId,
        title: 'Consulting Income',
        amount: 5000,
        minorUnits: 500000,
        type: 'income',
        category: 'Consulting',
        date: '2026-08-15',
        isRecurring: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await transactionRepository.create({
        id: 'tx_2',
        userId: testUserAId,
        title: 'Cloud Infrastructure',
        amount: 200,
        minorUnits: 20000,
        type: 'expense',
        category: 'Software',
        date: '2026-08-16',
        isRecurring: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const summary = await transactionRepository.getSummary(testUserAId);
      expect(summary.totalIncome).toBe(5000);
      expect(summary.totalExpense).toBe(200);
      expect(summary.netBalance).toBe(4800);
      expect(summary.transactionCount).toBe(2);

      // Budgets
      await budgetRepository.create({
        id: 'bdg_1',
        userId: testUserAId,
        category: 'Software',
        limitAmount: 500,
        limitMinorUnits: 50000,
        period: 'monthly',
        alertThresholdPercentage: 80,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const budget = await budgetRepository.findByCategory(testUserAId, 'software');
      expect(budget?.limitAmount).toBe(500);
    });

    it('handles encrypted journal entries transparently via ReflectionRepository', async () => {
      const saved = await reflectionRepository.upsert(testUserAId, '2026-08-30', {
        energyLevel: 9,
        clarityLevel: 8,
        stressLevel: 2,
        primaryEmotion: 'Focused and serene',
        journalEntry: 'Architecture is clean, interfaces are fully typed.',
        wins: ['Decoupled persistence layer'],
      });

      expect(saved.journalEntry).toBe('Architecture is clean, interfaces are fully typed.');

      // Verify underlying storage in JSON database is securely encrypted
      const rawInDb = db.schema.reflections.find((r) => r.userId === testUserAId && r.date === '2026-08-30');
      expect(rawInDb?.isEncrypted).toBe(true);
      expect(rawInDb?.journalEntry).not.toBe('Architecture is clean, interfaces are fully typed.');
      expect(rawInDb?.journalEntry).toContain(':'); // IV:AuthTag:Ciphertext format

      // Reading through reflectionRepository automatically decrypts
      const fetched = await reflectionRepository.findByDate(testUserAId, '2026-08-30');
      expect(fetched?.journalEntry).toBe('Architecture is clean, interfaces are fully typed.');
    });

    it('performs CRUD on Relationships and Interactions', async () => {
      const rel = await relationshipRepository.create({
        id: 'rel_1',
        userId: testUserAId,
        name: 'Sarah Connor',
        relationType: 'colleague',
        cadenceDays: 7,
        lastInteractionDate: '2026-08-20',
        nextDueReminderDate: '2026-08-27',
        notes: 'Core project manager',
        anniversaries: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(rel.id).toBe('rel_1');

      await interactionRepository.create({
        id: 'int_1',
        userId: testUserAId,
        contactId: 'rel_1',
        channel: 'in_person',
        date: '2026-08-20',
        notes: 'Reviewed sprint goals',
        createdAt: new Date().toISOString(),
      });

      const relInteractions = await interactionRepository.findByUserId(testUserAId, 'rel_1');
      expect(relInteractions.length).toBe(1);
    });

    it('performs CRUD on Notes via NoteRepository', async () => {
      const note = await noteRepository.create({
        id: 'not_1',
        userId: testUserAId,
        title: 'System Design Manifesto',
        content: 'Clean architecture with repositories.',
        folderId: 'fld_architecture',
        tags: ['architecture', 'solid'],
        isPinned: true,
        isArchived: false,
        linkedNoteIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(note.id).toBe('not_1');

      const userNotes = await noteRepository.findByUserId(testUserAId, { isPinned: true });
      expect(userNotes.length).toBe(1);
      expect(userNotes[0].title).toBe('System Design Manifesto');
    });

    it('performs CRUD on Notifications and Scheduled Notifications', async () => {
      const notif = await notificationRepository.create({
        id: 'notif_1',
        userId: testUserAId,
        title: 'Welcome to ORIGIN',
        message: 'Your personal OS is ready.',
        type: 'system_alert',
        priority: 'high',
        isRead: false,
        readAt: null,
        actionUrl: '/app/dashboard',
        entityReference: null,
        scheduledNotificationId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(notif.id).toBe('notif_1');
      expect(await notificationRepository.countUnreadByUserId(testUserAId)).toBe(1);

      await notificationRepository.markAsRead('notif_1', testUserAId);
      expect(await notificationRepository.countUnreadByUserId(testUserAId)).toBe(0);

      // Scheduled notification
      const sched = await scheduledNotificationRepository.create({
        id: 'snotif_1',
        userId: testUserAId,
        title: 'Daily Reflection Due',
        message: 'Take 5 minutes to review your day.',
        type: 'custom_reminder',
        priority: 'medium',
        scheduledFor: new Date(Date.now() + 3600000).toISOString(),
        status: 'scheduled',
        deliveredAt: null,
        actionUrl: '/app/emotions',
        entityReference: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(sched.id).toBe('snotif_1');

      const due = await scheduledNotificationRepository.findDue(Date.now() + 7200000);
      expect(due.length).toBe(1);
      expect(due[0].id).toBe('snotif_1');
    });
  });

  describe('2. User Ownership Isolation Verification', () => {
    it('prevents cross-tenant reads, updates, and deletes across repository methods', async () => {
      // Seed an entity owned by User A
      await taskRepository.create({
        id: 'tsk_user_a_private',
        userId: testUserAId,
        title: 'User A Secret Task',
        description: 'Classified',
        priority: 'urgent',
        status: 'todo',
        dueDate: null,
        scheduledTime: null,
        estimatedMinutes: null,
        actualMinutes: null,
        tags: [],
        goalId: null,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // User B cannot find User A's task
      const bList = await taskRepository.findByUserId(testUserBId);
      expect(bList.find((t) => t.id === 'tsk_user_a_private')).toBeUndefined();

      const bDirectFind = await taskRepository.findById('tsk_user_a_private', testUserBId);
      expect(bDirectFind).toBeNull();

      // User B cannot update User A's task
      const bUpdateAttempt = await taskRepository.update('tsk_user_a_private', testUserBId, {
        title: 'Hacked Title',
      });
      expect(bUpdateAttempt).toBeNull();

      // User B cannot delete User A's task
      const bDeleteAttempt = await taskRepository.delete('tsk_user_a_private', testUserBId);
      expect(bDeleteAttempt).toBe(false);

      // Verify task remains untouched for User A
      const aTask = await taskRepository.findById('tsk_user_a_private', testUserAId);
      expect(aTask?.title).toBe('User A Secret Task');
    });
  });

  describe('3. Multi-table User Lifecycle (Export and Account Purging)', () => {
    it('exports all user data across all tables strictly scoped to the user', async () => {
      // Seed data for User A
      await taskRepository.create({
        id: 'tsk_exp_1',
        userId: testUserAId,
        title: 'Task for export',
        description: '',
        priority: 'medium',
        status: 'todo',
        dueDate: null,
        scheduledTime: null,
        estimatedMinutes: null,
        actualMinutes: null,
        tags: [],
        goalId: null,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Seed data for User B
      await taskRepository.create({
        id: 'tsk_exp_2',
        userId: testUserBId,
        title: 'User B task',
        description: '',
        priority: 'medium',
        status: 'todo',
        dueDate: null,
        scheduledTime: null,
        estimatedMinutes: null,
        actualMinutes: null,
        tags: [],
        goalId: null,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const exportData = await userRepository.exportAllUserData(testUserAId);
      expect(exportData.user.id).toBe(testUserAId);
      expect(exportData.tasks.length).toBe(1);
      expect(exportData.tasks[0].id).toBe('tsk_exp_1');
    });

    it('purges all user data across all tables without affecting other users', async () => {
      await taskRepository.create({
        id: 'tsk_purge_a',
        userId: testUserAId,
        title: 'Task A',
        description: '',
        priority: 'medium',
        status: 'todo',
        dueDate: null,
        scheduledTime: null,
        estimatedMinutes: null,
        actualMinutes: null,
        tags: [],
        goalId: null,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await taskRepository.create({
        id: 'tsk_purge_b',
        userId: testUserBId,
        title: 'Task B',
        description: '',
        priority: 'medium',
        status: 'todo',
        dueDate: null,
        scheduledTime: null,
        estimatedMinutes: null,
        actualMinutes: null,
        tags: [],
        goalId: null,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await userRepository.purgeAllUserData(testUserAId);

      expect(await userRepository.findById(testUserAId)).toBeNull();
      expect(await taskRepository.findByUserId(testUserAId)).toEqual([]);

      // User B remains intact
      expect(await userRepository.findById(testUserBId)).not.toBeNull();
      const userBTasks = await taskRepository.findByUserId(testUserBId);
      expect(userBTasks.length).toBe(1);
      expect(userBTasks[0].id).toBe('tsk_purge_b');
    });
  });

  describe('4. API Layer Execution Through Repository Abstraction', () => {
    it('executes Task endpoints correctly via API routes', async () => {
      // POST /api/tasks
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'API Created Task',
          priority: 'high',
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body.success).toBe(true);
      const taskId = createRes.body.data.id;

      // GET /api/tasks
      const getRes = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.length).toBe(1);
      expect(getRes.body.data[0].id).toBe(taskId);

      // PUT /api/tasks/:id
      const putRes = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Updated via API',
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.title).toBe('Updated via API');

      // Cross-tenant PUT attempt returns 404
      const crossPutRes = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          title: 'Tampered by User B',
        });
      expect(crossPutRes.status).toBe(404);

      // DELETE /api/tasks/:id
      const delRes = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(delRes.status).toBe(200);

      // GET /api/tasks is now empty
      const afterDelRes = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(afterDelRes.body.data.length).toBe(0);
    });

    it('executes Habit and HabitLog endpoints correctly via API routes', async () => {
      const habitRes = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Morning Meditation',
          category: 'mindfulness',
        });

      expect(habitRes.status).toBe(200);
      const habitId = habitRes.body.data.id;

      // Log habit
      const logRes = await request(app)
        .post('/api/habits/log')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          habitId,
          completed: true,
        });

      expect(logRes.status).toBe(200);
      expect(logRes.body.data.habit.streakCount).toBe(1);

      // Query logs
      const logsRes = await request(app)
        .get('/api/habits/logs')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(logsRes.status).toBe(200);
      expect(logsRes.body.data.length).toBe(1);
    });

    it('executes Finance endpoints correctly via API routes', async () => {
      const txRes = await request(app)
        .post('/api/finances/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'SaaS Subscription',
          amount: 50,
          type: 'expense',
          category: 'Software',
          notes: 'Encrypted Note',
        });

      expect(txRes.status).toBe(200);

      const summaryRes = await request(app)
        .get('/api/finances/summary')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.totalExpense).toBe(50);
    });

    it('executes Reflection endpoints with encryption and decryption', async () => {
      const postRef = await request(app)
        .post('/api/emotions/reflections')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          date: '2026-08-30',
          journalEntry: 'Secret reflection content',
          energyLevel: 8,
        });

      expect(postRef.status).toBe(200);
      expect(postRef.body.data.journalEntry).toBe('Secret reflection content');

      const getRef = await request(app)
        .get('/api/emotions/reflections')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRef.status).toBe(200);
      expect(getRef.body.data[0].journalEntry).toBe('Secret reflection content');
    });

    it('executes Notification endpoints via API routes', async () => {
      const notifRes = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Alert',
          message: 'System notification',
          type: 'system_alert',
        });

      expect(notifRes.status).toBe(201);
      const notifId = notifRes.body.data.id;

      const unreadRes = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(unreadRes.body.data.count).toBe(1);

      const markReadRes = await request(app)
        .put(`/api/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(markReadRes.status).toBe(200);
      expect(markReadRes.body.data.isRead).toBe(true);
    });
  });

  describe('5. Database Engine & Repository Interchangeability', () => {
    it('verifies that repositories container bundles all domain interfaces', () => {
      expect(repositories.users).toBe(userRepository);
      expect(repositories.tasks).toBe(taskRepository);
      expect(repositories.habits).toBe(habitRepository);
      expect(repositories.habitLogs).toBe(habitLogRepository);
      expect(repositories.goals).toBe(goalRepository);
      expect(repositories.transactions).toBe(transactionRepository);
      expect(repositories.budgets).toBe(budgetRepository);
      expect(repositories.reflections).toBe(reflectionRepository);
      expect(repositories.relationships).toBe(relationshipRepository);
      expect(repositories.interactions).toBe(interactionRepository);
      expect(repositories.notes).toBe(noteRepository);
      expect(repositories.aiMemories).toBe(aiMemoryRepository);
      expect(repositories.auditLogs).toBe(auditLogRepository);
      expect(repositories.passwordResets).toBe(passwordResetRepository);
      expect(repositories.notifications).toBe(notificationRepository);
      expect(repositories.scheduledNotifications).toBe(scheduledNotificationRepository);
    });
  });
});
