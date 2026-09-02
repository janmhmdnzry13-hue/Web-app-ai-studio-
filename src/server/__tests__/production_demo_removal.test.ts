import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { db, DatabaseEngine } from '../db';
import { userRepository, taskRepository, habitRepository, goalRepository, transactionRepository, budgetRepository, relationshipRepository, noteRepository, aiMemoryRepository } from '../repositories';
import { GoalService } from '../../services/goal.service';
import { HabitService } from '../../services/habit.service';
import { RelationshipService } from '../../services/relationship.service';
import { FinanceService } from '../../services/finance.service';
import { NoteService } from '../../services/note.service';
import { AIMemoryService } from '../../services/ai/memory.service';
import { safeStorage } from '../../lib/storage';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Production Demo Removal and Isolation Verification Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset database schema to clean state for each test
    db.schema.users = [];
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
    db.schema.notifications = [];
    db.schema.scheduledNotifications = [];
    safeStorage.clear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // TEST 1: Production initialization does NOT create the shared demo account
  it('1. Production initialization does NOT create the shared demo account', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const freshEngine = new DatabaseEngine();
    const demoUser = freshEngine.schema.users.find(
      (u) => u.id === 'usr_origin_demo' || u.email.includes('demo') || u.email.includes('guest')
    );
    expect(demoUser).toBeUndefined();
    expect(freshEngine.schema.users).toHaveLength(0);

    // Production endpoint blocks automatic demo account creation
    const res = await request(app).post('/api/auth/demo').send();
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DEMO_DISABLED');
  });

  // TEST 2: Production initialization does NOT create demo tasks
  it('2. Production initialization does NOT create demo tasks', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const freshEngine = new DatabaseEngine();
    expect(freshEngine.schema.tasks).toHaveLength(0);

    // Calling seedUserStarterData in production does not insert tasks
    freshEngine.seedUserStarterData('prod_user_test');
    expect(freshEngine.schema.tasks.filter((t) => t.userId === 'prod_user_test')).toHaveLength(0);
  });

  // TEST 3: Production initialization does NOT create demo habits
  it('3. Production initialization does NOT create demo habits', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const freshEngine = new DatabaseEngine();
    expect(freshEngine.schema.habits).toHaveLength(0);
    expect(freshEngine.schema.habitLogs).toHaveLength(0);

    // Calling seedUserStarterData in production does not insert habits
    freshEngine.seedUserStarterData('prod_user_test');
    expect(freshEngine.schema.habits.filter((h) => h.userId === 'prod_user_test')).toHaveLength(0);
  });

  // TEST 4: Production initialization does NOT create demo goals
  it('4. Production initialization does NOT create demo goals', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const freshEngine = new DatabaseEngine();
    expect(freshEngine.schema.goals).toHaveLength(0);

    freshEngine.seedUserStarterData('prod_user_test');
    expect(freshEngine.schema.goals.filter((g) => g.userId === 'prod_user_test')).toHaveLength(0);
  });

  // TEST 5: Production initialization does NOT create demo financial records
  it('5. Production initialization does NOT create demo financial records', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const freshEngine = new DatabaseEngine();
    expect(freshEngine.schema.transactions).toHaveLength(0);
    expect(freshEngine.schema.budgets).toHaveLength(0);

    freshEngine.seedUserStarterData('prod_user_test');
    expect(freshEngine.schema.transactions.filter((tx) => tx.userId === 'prod_user_test')).toHaveLength(0);
    expect(freshEngine.schema.budgets.filter((b) => b.userId === 'prod_user_test')).toHaveLength(0);
  });

  // TEST 6: Production initialization does NOT create demo relationships
  it('6. Production initialization does NOT create demo relationships', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const freshEngine = new DatabaseEngine();
    expect(freshEngine.schema.relationships).toHaveLength(0);
    expect(freshEngine.schema.interactions).toHaveLength(0);

    freshEngine.seedUserStarterData('prod_user_test');
    expect(freshEngine.schema.relationships.filter((r) => r.userId === 'prod_user_test')).toHaveLength(0);
  });

  // TEST 7: Production initialization does NOT create demo notes
  it('7. Production initialization does NOT create demo notes', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const freshEngine = new DatabaseEngine();
    expect(freshEngine.schema.notes).toHaveLength(0);

    freshEngine.seedUserStarterData('prod_user_test');
    expect(freshEngine.schema.notes.filter((n) => n.userId === 'prod_user_test')).toHaveLength(0);
  });

  // TEST 8: Production initialization does NOT create demo AI memories
  it('8. Production initialization does NOT create demo AI memories', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const freshEngine = new DatabaseEngine();
    expect(freshEngine.schema.aiMemories).toHaveLength(0);

    const memoryService = new AIMemoryService();
    const memories = await memoryService.getMemories('prod_user_123');
    expect(memories.success).toBe(true);
    expect(memories.data).toHaveLength(0);
  });

  // TEST 9: Deleting a demo account in a development/test environment does not cause it to be recreated unless explicitly intended
  it('9. Deleting a demo account in a development/test environment does not cause it to be recreated unless explicitly intended', async () => {
    process.env.NODE_ENV = 'test';

    // Create demo session in dev/test
    const createRes = await request(app).post('/api/auth/demo').send();
    expect(createRes.status).toBe(200);
    const demoUser = createRes.body.data.user;

    // Delete the demo user from DB
    await userRepository.delete(demoUser.id);
    const foundUser = await userRepository.findById(demoUser.id);
    expect(foundUser).toBeNull();

    // Query client services for deleted demo user: should NOT resurrect or recreate
    const goalService = new GoalService();
    const goalsRes = await goalService.getGoals(demoUser.id);
    expect(goalsRes.success).toBe(true);
    expect(goalsRes.data).toHaveLength(0);

    const habitService = new HabitService();
    const habitsRes = await habitService.getHabits(demoUser.id);
    expect(habitsRes.success).toBe(true);
    expect(habitsRes.data).toHaveLength(0);

    const relService = new RelationshipService();
    const relsRes = await relService.getRelationships(demoUser.id);
    expect(relsRes.success).toBe(true);
    expect(relsRes.data).toHaveLength(0);

    const noteService = new NoteService();
    const notesRes = await noteService.getNotes(demoUser.id);
    expect(notesRes.success).toBe(true);
    expect(notesRes.data).toHaveLength(0);

    const finService = new FinanceService();
    const txsRes = await finService.getTransactions(demoUser.id);
    expect(txsRes.success).toBe(true);
    expect(txsRes.data).toHaveLength(0);
  });

  // TEST 10: A newly registered real user receives empty personal collections
  it('10. A newly registered real user receives empty personal collections', async () => {
    process.env.NODE_ENV = 'test';

    const signupEmail = `realuser_${Date.now()}@origin-test.com`;
    const signupRes = await request(app).post('/api/auth/signup').send({
      email: signupEmail,
      password: 'StrongPassword123!',
      displayName: 'Real Human User',
    });

    expect(signupRes.status).toBe(200);
    const newUserId = signupRes.body.data.user.id;
    const token = signupRes.body.data.token;

    // Verify personal collections are completely empty for new user
    const tasksRes = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(tasksRes.status).toBe(200);
    expect(tasksRes.body.data).toHaveLength(0);

    const habitsRes = await request(app).get('/api/habits').set('Authorization', `Bearer ${token}`);
    expect(habitsRes.status).toBe(200);
    expect(habitsRes.body.data).toHaveLength(0);

    const goalsRes = await request(app).get('/api/goals').set('Authorization', `Bearer ${token}`);
    expect(goalsRes.status).toBe(200);
    expect(goalsRes.body.data).toHaveLength(0);

    const txsRes = await request(app).get('/api/finances/transactions').set('Authorization', `Bearer ${token}`);
    expect(txsRes.status).toBe(200);
    expect(txsRes.body.data).toHaveLength(0);

    const relsRes = await request(app).get('/api/relationships').set('Authorization', `Bearer ${token}`);
    expect(relsRes.status).toBe(200);
    expect(relsRes.body.data).toHaveLength(0);

    const notesRes = await request(app).get('/api/notes').set('Authorization', `Bearer ${token}`);
    expect(notesRes.status).toBe(200);
    expect(notesRes.body.data).toHaveLength(0);

    const userTasksInDb = db.schema.tasks.filter((t) => t.userId === newUserId);
    expect(userTasksInDb).toHaveLength(0);
    const userHabitsInDb = db.schema.habits.filter((h) => h.userId === newUserId);
    expect(userHabitsInDb).toHaveLength(0);
  });

  // TEST 11: Existing real-user data is not modified by initialization
  it('11. Existing real-user data is not modified by initialization', async () => {
    // Add real user with their personal data
    const realUser = {
      id: 'usr_real_existing_123',
      email: 'existing.founder@domain.com',
      passwordHash: 'hash_secret',
      role: 'member' as const,
      emailVerified: true,
      profile: { displayName: 'Existing Founder' },
      preferences: {
        theme: 'dark' as const,
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1 as const,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.schema.users.push(realUser);

    const realTask = {
      id: 'task_real_1',
      userId: realUser.id,
      title: 'Private Confidential Real Strategy',
      priority: 'urgent' as const,
      status: 'todo' as const,
      tags: ['confidential'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.schema.tasks.push(realTask);

    // Initialize fresh DatabaseEngine instance
    const freshEngine = new DatabaseEngine();

    // Verify existing real user and real task are completely intact
    const fetchedUser = db.schema.users.find((u) => u.id === realUser.id);
    expect(fetchedUser).toBeDefined();
    expect(fetchedUser?.email).toBe('existing.founder@domain.com');

    const fetchedTask = db.schema.tasks.find((t) => t.id === realTask.id);
    expect(fetchedTask).toBeDefined();
    expect(fetchedTask?.title).toBe('Private Confidential Real Strategy');
    expect(fetchedTask?.userId).toBe(realUser.id);
  });

  // TEST 12: Development/test demo behavior remains available only when explicitly enabled
  it('12. Development/test demo behavior remains available only when explicitly enabled', async () => {
    // In production without demo flag: blocked with 403 DEMO_DISABLED
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
    delete process.env.ENABLE_DEMO_ENVIRONMENT;

    const prodRes = await request(app).post('/api/auth/demo').send();
    expect(prodRes.status).toBe(403);
    expect(prodRes.body.error.code).toBe('DEMO_DISABLED');

    // In dev/test: demo behavior is available
    process.env.NODE_ENV = 'test';
    const testRes = await request(app).post('/api/auth/demo').send();
    expect(testRes.status).toBe(200);
    expect(testRes.body.data.user.id).toMatch(/^usr_demo_/);

    // In development mode: demo behavior is available
    process.env.NODE_ENV = 'development';
    const devRes = await request(app).post('/api/auth/demo').send();
    expect(devRes.status).toBe(200);
    expect(devRes.body.data.user.id).toMatch(/^usr_demo_/);
  });
});
