import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter, resetRateLimitsForTesting } from '../routes';
import { requireAuth, AuthenticatedRequest, generateToken, hashPassword } from '../auth';
import { db, UserRecord } from '../db';
import { validateBody, aiChatSchema, aiInsightsSchema } from '../validation';
import { buildServerAuthorizedAIContext } from '../ai-context';
import { generateLocalAIResponse, generateLocalDynamicInsights } from '../../services/ai/local-engine';

// Build the test Express application mirroring server.ts routing
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api', apiRouter);

// Mount server-side AI endpoints under test matching server.ts behavior
app.post('/api/ai/chat', requireAuth, validateBody(aiChatSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const { message, moduleContext } = req.body;
    const trustedContext = buildServerAuthorizedAIContext(userId);
    const fallbackResponse = generateLocalAIResponse(
      message.trim(),
      trustedContext,
      moduleContext,
      trustedContext.memories
    );
    res.json({
      success: true,
      data: fallbackResponse,
      provider: 'local-test-engine',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

app.post('/api/ai/insights', requireAuth, validateBody(aiInsightsSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const trustedContext = buildServerAuthorizedAIContext(userId);
    const insights = generateLocalDynamicInsights(trustedContext);
    res.json({
      success: true,
      data: insights,
      provider: 'local-test-engine',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

describe('Backend API Routes Integration Test Suite', () => {
  let userA: { record: UserRecord; token: string; rawPassword: string };
  let userB: { record: UserRecord; token: string; rawPassword: string };

  beforeEach(() => {
    resetRateLimitsForTesting();

    const timestamp = Date.now() + Math.floor(Math.random() * 100000);

    // Setup isolated User A
    const rawPassA = 'PassUserA123!';
    const recordA: UserRecord = {
      id: `usr_int_a_${timestamp}`,
      email: `user.a.${timestamp}@origin-os.internal`,
      passwordHash: hashPassword(rawPassA),
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Alice Architect',
        headline: 'System Designer',
        bio: 'Focusing on deep work and balance',
        primaryLifeFocus: 'Engineering & Wellness',
      },
      preferences: {
        theme: 'dark',
        timezone: 'America/New_York',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: '21:00',
        notificationChannels: { inApp: true, email: false, dailyDigest: true },
        unlockedModules: ['tasks', 'habits', 'finances', 'goals', 'notes', 'relationships'],
      },
      subscription: {
        tier: 'pro',
        status: 'active',
        currentPeriodEnd: '2027-01-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Setup isolated User B
    const rawPassB = 'PassUserB456!';
    const recordB: UserRecord = {
      id: `usr_int_b_${timestamp}`,
      email: `user.b.${timestamp}@origin-os.internal`,
      passwordHash: hashPassword(rawPassB),
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Bob Builder',
        headline: 'Product Specialist',
        bio: 'Building habits daily',
        primaryLifeFocus: 'Habit Formation',
      },
      preferences: {
        theme: 'light',
        timezone: 'Europe/London',
        locale: 'en-GB',
        weekStartDay: 0,
        reducedMotion: true,
        compactDensity: true,
        dailyReflectionReminderTime: '20:00',
        notificationChannels: { inApp: true, email: true, dailyDigest: false },
        unlockedModules: ['tasks', 'habits'],
      },
      subscription: {
        tier: 'free',
        status: 'active',
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.users.push(recordA, recordB);

    userA = { record: recordA, token: generateToken(recordA), rawPassword: rawPassA };
    userB = { record: recordB, token: generateToken(recordB), rawPassword: rawPassB };
  });

  // =========================================================================
  // 1. SIGNUP ENDPOINT
  // =========================================================================
  describe('1. Signup Endpoint (POST /api/auth/signup)', () => {
    it('creates a new user with valid payload and returns 200, JWT token, and safe public user', async () => {
      const email = `new.signup.${Date.now()}@origin-os.internal`;
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email,
          password: 'StrongPassword123!',
          displayName: 'New Explorer',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(email.toLowerCase());
      expect(res.body.data.user.profile.displayName).toBe('New Explorer');
      expect(res.body.data.user.role).toBe('member');
    });

    it('rejects duplicate email registration with HTTP 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: userA.record.email,
          password: 'AnyPassword123!',
          displayName: 'Duplicate Attempt',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_EMAIL_EXISTS');
    });

    it('rejects invalid signup payloads (missing email, invalid email format, short password) with HTTP 400', async () => {
      // Missing password
      const res1 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'valid@origin-os.internal', displayName: 'No Pass' });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      // Short password (< 6 chars)
      const res2 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'valid2@origin-os.internal', password: '123', displayName: 'Short Pass' });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);

      // Invalid email syntax
      const res3 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: 'ValidPassword123!', displayName: 'Bad Email' });
      expect(res3.status).toBe(400);
      expect(res3.body.success).toBe(false);

      // Missing displayName
      const res4 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'valid3@origin-os.internal', password: 'ValidPassword123!' });
      expect(res4.status).toBe(400);
      expect(res4.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. LOGIN ENDPOINT
  // =========================================================================
  describe('2. Login Endpoint (POST /api/auth/login)', () => {
    it('authenticates valid credentials, returning 200, JWT token, and safe user data', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userA.record.email,
          password: userA.rawPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.id).toBe(userA.record.id);
      expect(res.body.data.user.email).toBe(userA.record.email);
    });

    it('rejects incorrect password with HTTP 401 Unauthorized and AUTH_INVALID_CREDENTIALS', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userA.record.email,
          password: 'IncorrectPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('rejects non-existent email with HTTP 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent.user.99999@origin-os.internal',
          password: 'SomePassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('rejects empty or missing login credentials with HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. SESSION & CURRENT USER ENDPOINTS
  // =========================================================================
  describe('3. Session & Current User Endpoints', () => {
    it('GET /api/auth/session returns authenticated user profile with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(userA.record.id);
      expect(res.body.data.user.profile.displayName).toBe('Alice Architect');
    });

    it('GET /api/users/me and GET /api/users/profile return current user profile', async () => {
      const resMe = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(resMe.status).toBe(200);
      expect(resMe.body.data.id).toBe(userA.record.id);

      const resProfile = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(resProfile.status).toBe(200);
      expect(resProfile.body.data.id).toBe(userA.record.id);
      expect(resProfile.body.data.profile.headline).toBe('System Designer');
    });

    it('GET /api/users/preferences returns user preference settings', async () => {
      const res = await request(app)
        .get('/api/users/preferences')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.preferences.theme).toBe('dark');
      expect(res.body.data.preferences.timezone).toBe('America/New_York');
    });
  });

  // =========================================================================
  // 4. PROTECTED RESOURCE ENDPOINTS (TASKS, HABITS, GOALS, FINANCES, NOTES)
  // =========================================================================
  describe('4. Protected Resource Endpoints (CRUD operations)', () => {
    it('creates, retrieves, updates, and deletes a Task resource via real HTTP calls', async () => {
      // 4a. Create Task
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          title: 'Architect Microservices Boundary',
          description: 'Define clear domain contexts',
          priority: 'high',
          estimatedMinutes: 90,
          tags: ['architecture', 'deepwork'],
        });

      expect([200, 201]).toContain(createRes.status);
      expect(createRes.body.success).toBe(true);
      const createdTask = createRes.body.data;
      expect(createdTask.id).toBeDefined();
      expect(createdTask.title).toBe('Architect Microservices Boundary');
      expect(createdTask.userId).toBe(userA.record.id);
      expect(createdTask.status).toBe('todo');

      // 4b. List Tasks
      const listRes = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      const found = listRes.body.data.find((t: any) => t.id === createdTask.id);
      expect(found).toBeDefined();

      // 4c. Update Task Status
      const updateRes = await request(app)
        .put(`/api/tasks/${createdTask.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          status: 'completed',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('completed');

      // 4d. Delete Task
      const deleteRes = await request(app)
        .delete(`/api/tasks/${createdTask.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify task is deleted
      const verifyList = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(verifyList.body.data.find((t: any) => t.id === createdTask.id)).toBeUndefined();
    });

    it('creates, retrieves, and logs completion for a Habit resource', async () => {
      // 4e. Create Habit
      const createRes = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          name: 'Morning Meditation',
          category: 'mind',
          frequency: 'daily',
          targetDays: [0, 1, 2, 3, 4, 5, 6],
          timeOfDay: 'morning',
        });

      expect([200, 201]).toContain(createRes.status);
      expect(createRes.body.success).toBe(true);
      const habit = createRes.body.data;
      expect(habit.id).toBeDefined();
      expect(habit.name).toBe('Morning Meditation');

      // 4f. List Habits
      const listRes = await request(app)
        .get('/api/habits')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.find((h: any) => h.id === habit.id)).toBeDefined();

      // 4g. Log Habit Completion
      const logRes = await request(app)
        .post('/api/habits/log')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          habitId: habit.id,
          date: new Date().toISOString().slice(0, 10),
          completed: true,
          notes: 'Deep 15 minute session',
        });

      expect(logRes.status).toBe(200);
      expect(logRes.body.success).toBe(true);
      expect(logRes.body.data.habit.streakCount).toBeGreaterThanOrEqual(1);
    });

    it('creates and manages Goal, Note, Finance, and Relationship resources', async () => {
      // 4h. Create Goal
      const goalRes = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          title: 'Publish Open Source Architecture Guide',
          domain: 'career',
          targetDate: '2026-12-31',
          milestones: [{ id: 'm1', title: 'Complete Draft', completed: false }],
        });

      expect([200, 201]).toContain(goalRes.status);
      expect(goalRes.body.data.title).toBe('Publish Open Source Architecture Guide');
      const goalId = goalRes.body.data.id;

      // 4i. Create Note
      const noteRes = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          title: 'System Boundary Thoughts',
          content: 'Domain models must remain decoupled from storage.',
          tags: ['architecture'],
        });

      expect([200, 201]).toContain(noteRes.status);
      const noteId = noteRes.body.data.id;

      // 4j. Create Finance Transaction
      const txRes = await request(app)
        .post('/api/finances/transactions')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          title: 'Technical Reference Book',
          amount: 45.5,
          type: 'expense',
          category: 'education',
          date: '2026-08-29',
        });

      expect([200, 201]).toContain(txRes.status);
      const txId = txRes.body.data.id;

      // 4k. Create Relationship
      const relRes = await request(app)
        .post('/api/relationships')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          name: 'Elena Rostova',
          relationType: 'mentor',
          cadenceDays: 14,
        });

      expect([200, 201]).toContain(relRes.status);
      const relId = relRes.body.data.id;

      // Cleanup
      await request(app).delete(`/api/goals/${goalId}`).set('Authorization', `Bearer ${userA.token}`);
      await request(app).delete(`/api/notes/${noteId}`).set('Authorization', `Bearer ${userA.token}`);
      await request(app).delete(`/api/finances/transactions/${txId}`).set('Authorization', `Bearer ${userA.token}`);
      await request(app).delete(`/api/relationships/${relId}`).set('Authorization', `Bearer ${userA.token}`);
    });
  });

  // =========================================================================
  // 5. UNAUTHORIZED REQUESTS TO PROTECTED ENDPOINTS
  // =========================================================================
  describe('5. Unauthorized Request to Protected Endpoints', () => {
    it('returns HTTP 401 when Authorization header is omitted', async () => {
      const endpoints = [
        { method: 'get', url: '/api/auth/session' },
        { method: 'get', url: '/api/users/profile' },
        { method: 'get', url: '/api/users/preferences' },
        { method: 'get', url: '/api/tasks' },
        { method: 'post', url: '/api/tasks', body: { title: 'Unauthorized task' } },
        { method: 'get', url: '/api/habits' },
        { method: 'get', url: '/api/goals' },
        { method: 'get', url: '/api/finances/transactions' },
        { method: 'get', url: '/api/notes' },
        { method: 'get', url: '/api/emotions/reflections' },
        { method: 'get', url: '/api/relationships' },
        { method: 'get', url: '/api/billing/subscription' },
        { method: 'get', url: '/api/audit/logs' },
      ];

      for (const ep of endpoints) {
        let req = (request(app) as any)[ep.method](ep.url);
        if (ep.body) req = req.send(ep.body);

        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error?.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns HTTP 401 when Authorization token is invalid or malformed', async () => {
      const res1 = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res1.status).toBe(401);
      expect(res1.body.success).toBe(false);
      expect(res1.body.error.code).toBe('INVALID_TOKEN');

      const res2 = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=');

      expect(res2.status).toBe(401);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 6. USER A ATTEMPTING TO ACCESS USER B'S RESOURCES (MULTI-TENANT ISOLATION)
  // =========================================================================
  describe("6. Authorization Isolation: User A cannot access or mutate User B's resources", () => {
    let userA_taskId: string;
    let userA_habitId: string;
    let userA_goalId: string;
    let userA_noteId: string;
    let userA_txId: string;
    let userA_relId: string;

    beforeEach(async () => {
      // User A creates resources
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ title: "Alice's Secret Task", priority: 'high' });
      userA_taskId = taskRes.body.data.id;

      const habitRes = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: "Alice's Habit", frequency: 'daily', targetDays: [1, 2, 3] });
      userA_habitId = habitRes.body.data.id;

      const goalRes = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ title: "Alice's Secret Goal", domain: 'career', targetDate: '2027-01-01' });
      userA_goalId = goalRes.body.data.id;

      const noteRes = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ title: "Alice's Private Note", content: 'Confidential system plans' });
      userA_noteId = noteRes.body.data.id;

      const txRes = await request(app)
        .post('/api/finances/transactions')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ title: "Alice's Consulting", amount: 1500, type: 'income', category: 'consulting', date: '2026-08-29' });
      userA_txId = txRes.body.data.id;

      const relRes = await request(app)
        .post('/api/relationships')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: "Alice's Confidante", relationType: 'friend' });
      userA_relId = relRes.body.data.id;
    });

    it("User B's collection listings never include User A's items", async () => {
      // User B lists tasks
      const taskList = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${userB.token}`);
      expect(taskList.body.data.find((t: any) => t.id === userA_taskId)).toBeUndefined();

      // User B lists habits
      const habitList = await request(app)
        .get('/api/habits')
        .set('Authorization', `Bearer ${userB.token}`);
      expect(habitList.body.data.find((h: any) => h.id === userA_habitId)).toBeUndefined();

      // User B lists goals
      const goalList = await request(app)
        .get('/api/goals')
        .set('Authorization', `Bearer ${userB.token}`);
      expect(goalList.body.data.find((g: any) => g.id === userA_goalId)).toBeUndefined();

      // User B lists notes
      const noteList = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${userB.token}`);
      expect(noteList.body.data.find((n: any) => n.id === userA_noteId)).toBeUndefined();

      // User B lists transactions
      const txList = await request(app)
        .get('/api/finances/transactions')
        .set('Authorization', `Bearer ${userB.token}`);
      expect(txList.body.data.find((tx: any) => tx.id === userA_txId)).toBeUndefined();
    });

    it("User B attempting to update or delete User A's Task returns HTTP 404", async () => {
      const updateRes = await request(app)
        .put(`/api/tasks/${userA_taskId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ title: 'Hacked by Bob' });
      expect(updateRes.status).toBe(404);
      expect(updateRes.body.success).toBe(false);

      const deleteRes = await request(app)
        .delete(`/api/tasks/${userA_taskId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.success).toBe(false);
    });

    it("User B attempting to modify or delete User A's Habit, Goal, Note, Transaction, or Relationship returns HTTP 404", async () => {
      // Habit
      const habitUpdate = await request(app)
        .put(`/api/habits/${userA_habitId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ name: 'Tampered' });
      expect(habitUpdate.status).toBe(404);

      const habitLog = await request(app)
        .post('/api/habits/log')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ habitId: userA_habitId, date: '2026-08-29', completed: true });
      expect(habitLog.status).toBe(404);

      // Goal
      const goalDelete = await request(app)
        .delete(`/api/goals/${userA_goalId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(goalDelete.status).toBe(404);

      // Note
      const noteUpdate = await request(app)
        .put(`/api/notes/${userA_noteId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ title: 'Tampered note title' });
      expect(noteUpdate.status).toBe(404);

      // Transaction
      const txDelete = await request(app)
        .delete(`/api/finances/transactions/${userA_txId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(txDelete.status).toBe(404);

      // Relationship
      const relDelete = await request(app)
        .delete(`/api/relationships/${userA_relId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(relDelete.status).toBe(404);
    });
  });

  // =========================================================================
  // 7. INVALID REQUEST BODY HANDLING
  // =========================================================================
  describe('7. Invalid Request Body Validation (HTTP 400)', () => {
    it('rejects missing or empty required fields with HTTP 400 and structured validation errors', async () => {
      // Task with empty title
      const res1 = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ title: '   ' });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);
      expect(res1.body.error).toBeDefined();

      // Habit missing name
      const res2 = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: '   ', frequency: 'daily' });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);

      // Goal missing targetDate or title
      const res3 = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ title: '   ', domain: 'career' });
      expect(res3.status).toBe(400);
      expect(res3.body.success).toBe(false);

      // Finance transaction with negative amount or invalid type
      const res4 = await request(app)
        .post('/api/finances/transactions')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ title: 'Invalid Tx', amount: -50, type: 'invalid_type', category: 'food', date: '2026-08-29' });
      expect(res4.status).toBe(400);
      expect(res4.body.success).toBe(false);

      // Relationship with empty name
      const res5 = await request(app)
        .post('/api/relationships')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: '   ' });
      expect(res5.status).toBe(400);
      expect(res5.body.success).toBe(false);
    });

    it('rejects non-object or malformed JSON payloads with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send(null as any);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 8. VALID REQUEST BODY (UPDATES & CREATION)
  // =========================================================================
  describe('8. Valid Request Body Processing (HTTP 200 & 201)', () => {
    it('accepts valid profile and preference updates and returns updated state', async () => {
      const profileUpdateRes = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          headline: 'Principal Security Architect',
          bio: 'Elevating digital autonomy and craft',
          primaryLifeFocus: 'Resilience and Precision',
        });

      expect(profileUpdateRes.status).toBe(200);
      expect(profileUpdateRes.body.success).toBe(true);
      expect(profileUpdateRes.body.data.profile.headline).toBe('Principal Security Architect');
      expect(profileUpdateRes.body.data.profile.bio).toBe('Elevating digital autonomy and craft');

      const prefUpdateRes = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          theme: 'light',
          timezone: 'America/Chicago',
          compactDensity: true,
          dailyReflectionReminderTime: '22:30',
        });

      expect(prefUpdateRes.status).toBe(200);
      expect(prefUpdateRes.body.success).toBe(true);
      expect(prefUpdateRes.body.data.preferences.theme).toBe('light');
      expect(prefUpdateRes.body.data.preferences.timezone).toBe('America/Chicago');
      expect(prefUpdateRes.body.data.preferences.compactDensity).toBe(true);
    });
  });

  // =========================================================================
  // 9. PASSWORD HASH NEVER APPEARING IN API RESPONSES
  // =========================================================================
  describe('9. PasswordHash & Secret Zero-Leakage Guarantee', () => {
    it('guarantees passwordHash is never returned in signup, login, session, profile, or export endpoints', async () => {
      // 9a. Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `zero.leak.${Date.now()}@origin-os.internal`,
          password: 'ZeroLeakPassword123!',
          displayName: 'Zero Leak User',
        });
      expect(signupRes.body.data.user.passwordHash).toBeUndefined();
      expect(signupRes.body.data.user.verificationToken).toBeUndefined();
      expect(JSON.stringify(signupRes.body)).not.toContain('passwordHash');

      // 9b. Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: userA.record.email,
          password: userA.rawPassword,
        });
      expect(loginRes.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(loginRes.body)).not.toContain('passwordHash');

      // 9c. Session
      const sessionRes = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(sessionRes.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(sessionRes.body)).not.toContain('passwordHash');

      // 9d. Profile
      const profileRes = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(profileRes.body.data.passwordHash).toBeUndefined();
      expect(JSON.stringify(profileRes.body)).not.toContain('passwordHash');

      // 9e. Export Data
      const exportRes = await request(app)
        .post('/api/auth/export-data')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(exportRes.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(exportRes.body)).not.toContain('passwordHash');
    });
  });

  // =========================================================================
  // 10. AI ENDPOINT AUTHENTICATION & INPUT VALIDATION
  // =========================================================================
  describe('10. AI Endpoints Authentication & Input Requirement', () => {
    it('rejects unauthenticated requests to AI chat and AI insights with HTTP 401', async () => {
      const chatRes = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'Hello AI co-pilot' });
      expect(chatRes.status).toBe(401);
      expect(chatRes.body.success).toBe(false);

      const insightsRes = await request(app)
        .post('/api/ai/insights')
        .send({});
      expect(insightsRes.status).toBe(401);
      expect(insightsRes.body.success).toBe(false);
    });

    it('rejects AI chat requests with empty or missing message with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('processes authenticated AI chat and AI insights requests with HTTP 200', async () => {
      const chatRes = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          message: 'Review my productivity cadence and active goals',
          moduleContext: 'tasks',
        });

      expect(chatRes.status).toBe(200);
      expect(chatRes.body.success).toBe(true);
      expect(chatRes.body.data).toBeDefined();
      expect(chatRes.body.data.reply).toBeDefined();

      const insightsRes = await request(app)
        .post('/api/ai/insights')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({});

      expect(insightsRes.status).toBe(200);
      expect(insightsRes.body.success).toBe(true);
      expect(Array.isArray(insightsRes.body.data)).toBe(true);
    });
  });

  // =========================================================================
  // 11. HTTP ERROR RESPONSES CONSISTENCY
  // =========================================================================
  describe('11. Standard HTTP Error Response Structure', () => {
    it('returns standard { success: false, error: { code, message } } across all error conditions', async () => {
      // 400 Bad Request
      const res400 = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({});
      expect(res400.status).toBe(400);
      expect(res400.body.success).toBe(false);
      expect(typeof res400.body.error.code).toBe('string');
      expect(typeof res400.body.error.message).toBe('string');

      // 401 Unauthorized
      const res401 = await request(app).get('/api/tasks');
      expect(res401.status).toBe(401);
      expect(res401.body.success).toBe(false);
      expect(typeof res401.body.error.code).toBe('string');
      expect(typeof res401.body.error.message).toBe('string');

      // 404 Not Found
      const res404 = await request(app)
        .delete('/api/tasks/non_existent_task_id_99999')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res404.status).toBe(404);
      expect(res404.body.success).toBe(false);
      expect(['NOT_FOUND', 'TASK_NOT_FOUND']).toContain(res404.body.error.code);
      expect(typeof res404.body.error.message).toBe('string');

      // 409 Conflict
      const res409 = await request(app)
        .post('/api/auth/signup')
        .send({
          email: userA.record.email,
          password: 'ValidPassword123!',
          displayName: 'Conflict Attempt',
        });
      expect(res409.status).toBe(409);
      expect(res409.body.success).toBe(false);
      expect(res409.body.error.code).toBe('AUTH_EMAIL_EXISTS');
      expect(typeof res409.body.error.message).toBe('string');
    });
  });
});
