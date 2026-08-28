import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { requireAuth, AuthenticatedRequest, generateToken } from '../auth';
import { db, UserRecord, TaskRecord, HabitRecord, GoalRecord, TransactionRecord, ReflectionRecord, NoteRecord, AIMemoryRecord } from '../db';
import { buildServerAuthorizedAIContext, buildSecureAIPrompt } from '../ai-context';
import { checkRateLimit, resetRateLimitsForTesting } from '../rate-limiter';
import { generateLocalAIResponse, generateLocalDynamicInsights } from '../../services/ai/local-engine';

// Build isolated Express app mirroring server.ts AI routing architecture
const app = express();
app.use(express.json());

// Server-side AI Chat Endpoint (Mirroring server.ts)
app.post('/api/ai/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    if (!checkRateLimit(`ai_chat_${userId}`, 30, 60000)) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' },
      });
      return;
    }

    const { message, conversationHistory, moduleContext } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Missing or invalid message string.' } });
      return;
    }

    // Retrieve authorized user data directly from server database with strict ownership check
    const trustedContext = buildServerAuthorizedAIContext(userId);

    // Generate local intelligence response using trusted context (emulating fallback or standard execution)
    const aiResponse = generateLocalAIResponse(
      message.trim(),
      trustedContext,
      moduleContext,
      trustedContext.memories
    );

    res.json({
      success: true,
      data: aiResponse,
      provider: 'local-test-engine',
      authorizedUser: trustedContext.user.displayName,
      taskCount: trustedContext.tasks.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Server-side AI Insights Endpoint (Mirroring server.ts)
app.post('/api/ai/insights', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    if (!checkRateLimit(`ai_insights_${userId}`, 20, 60000)) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' },
      });
      return;
    }

    // Retrieve authorized user data directly from server database with strict ownership check
    const trustedContext = buildServerAuthorizedAIContext(userId);
    const insights = generateLocalDynamicInsights(trustedContext);

    res.json({
      success: true,
      data: insights,
      provider: 'local-test-engine',
      authorizedUser: trustedContext.user.displayName,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

function createMockUser(id: string, email: string, displayName: string): { user: UserRecord; token: string } {
  const user: UserRecord = {
    id,
    email: email.toLowerCase(),
    passwordHash: 'dummy_hashed_password',
    role: 'member',
    emailVerified: true,
    profile: { displayName, headline: `${displayName} Headline`, bio: '', primaryLifeFocus: 'Deep Focus' },
    preferences: {
      theme: 'system',
      timezone: 'America/New_York',
      locale: 'en-US',
      weekStartDay: 1,
      reducedMotion: false,
      compactDensity: false,
      dailyReflectionReminderTime: null,
      notificationChannels: { inApp: true, email: false, dailyDigest: false },
    },
    subscription: { tier: 'pro', status: 'active' },
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.schema.users.push(user);
  const token = generateToken(user);
  return { user, token };
}

describe('ORIGIN AI Secure Data Context & Authority Suite', () => {
  let userA: { user: UserRecord; token: string };
  let userB: { user: UserRecord; token: string };

  beforeEach(() => {
    resetRateLimitsForTesting();
    // Seed isolated test users
    db.schema.users = [];
    db.schema.tasks = [];
    db.schema.habits = [];
    db.schema.goals = [];
    db.schema.transactions = [];
    db.schema.budgets = [];
    db.schema.reflections = [];
    db.schema.relationships = [];
    db.schema.notes = [];
    db.schema.aiMemories = [];

    userA = createMockUser('usr_alice_123', 'alice@origin.internal', 'Alice Sovereign');
    userB = createMockUser('usr_bob_456', 'bob@origin.internal', 'Bob Confidential');

    // Populate User A's private data
    db.schema.tasks.push({
      id: 'tsk_alice_1',
      userId: userA.user.id,
      title: 'Alice Project Aurora Deliverable',
      priority: 'high',
      status: 'in_progress',
      tags: ['aurora'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.habits.push({
      id: 'hbt_alice_1',
      userId: userA.user.id,
      name: 'Alice 10km Morning Run',
      category: 'health',
      frequency: 'daily',
      targetPerDay: 1,
      streakCount: 15,
      bestStreak: 20,
      totalCompletions: 30,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.notes.push({
      id: 'not_alice_1',
      userId: userA.user.id,
      title: 'Alice Private Project Aurora Notes',
      content: db.encrypt('Top secret cryptographic seed phrase for Aurora project'),
      tags: ['private'],
      isPinned: true,
      isArchived: false,
      linkedNoteIds: [],
      isEncrypted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Populate User B's confidential private data
    db.schema.tasks.push({
      id: 'tsk_bob_1',
      userId: userB.user.id,
      title: 'Bob Confidential M&A Acquisition',
      priority: 'urgent',
      status: 'todo',
      tags: ['m&a'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.habits.push({
      id: 'hbt_bob_1',
      userId: userB.user.id,
      name: 'Bob Evening Mindfulness',
      category: 'mindfulness',
      frequency: 'daily',
      targetPerDay: 1,
      streakCount: 45,
      bestStreak: 45,
      totalCompletions: 90,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.notes.push({
      id: 'not_bob_1',
      userId: userB.user.id,
      title: 'Bob Confidential Acquisition Terms',
      content: db.encrypt('Confidential acquisition price: $42,000,000 USD'),
      tags: ['confidential'],
      isPinned: true,
      isArchived: false,
      linkedNoteIds: [],
      isEncrypted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TEST 1: User A cannot request User B's AI context
  it('1. User A cannot request or receive User B AI context; queries are strictly tenant-isolated', async () => {
    // Inspect context built for User A
    const aliceContext = buildServerAuthorizedAIContext(userA.user.id);
    expect(aliceContext.user.id).toBe(userA.user.id);
    expect(aliceContext.user.displayName).toBe('Alice Sovereign');
    expect(aliceContext.tasks).toHaveLength(1);
    expect(aliceContext.tasks[0].title).toBe('Alice Project Aurora Deliverable');
    expect(aliceContext.habits).toHaveLength(1);
    expect(aliceContext.habits[0].name).toBe('Alice 10km Morning Run');

    // Confirm that none of Bob's entities are included in Alice's context
    const hasBobTask = aliceContext.tasks.some((t) => t.title.includes('Bob') || t.title.includes('M&A'));
    const hasBobHabit = aliceContext.habits.some((h) => h.name.includes('Bob'));
    const hasBobNote = aliceContext.notes.some((n) => n.title.includes('Bob'));

    expect(hasBobTask).toBe(false);
    expect(hasBobHabit).toBe(false);
    expect(hasBobNote).toBe(false);
  });

  // TEST 2: Client-provided userId cannot override authenticated identity
  it('2. Client-provided userId in request body or query cannot override verified JWT identity', async () => {
    // Alice maliciously sends Bob's userId in the request payload
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        userId: userB.user.id, // Malicious spoofing attempt
        targetUserId: userB.user.id,
        message: 'Plan my day and list my active tasks',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.authorizedUser).toBe('Alice Sovereign'); // Must resolve to Alice
    expect(res.body.taskCount).toBe(1); // Alice has 1 task
    // The response reasoning summary or reply should only refer to Alice's task
    expect(res.body.data.reasoningSummary).not.toContain('Bob');
    expect(res.body.data.reasoningSummary).not.toContain('Acquisition');
  });

  // TEST 3: Client-provided context cannot retrieve another user's private data or override server truth
  it('3. Client-provided context cannot inject fake account entities or override server-authoritative data', async () => {
    // Alice sends a fake context object pretending to have Bob's tasks
    const spoofedContext = {
      tasks: [
        { id: 'fake_1', title: 'Fake Injected Secret M&A Task', priority: 'urgent', status: 'todo' },
      ],
      finances: {
        monthlyIncome: 1000000,
        monthlyExpenses: 500,
        netBalance: 999500,
      },
    };

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        message: 'Plan my day',
        context: spoofedContext, // Untrusted client payload
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Task count must remain Alice's real task count (1), ignoring the spoofed payload
    expect(res.body.taskCount).toBe(1);
  });

  // TEST 4: Authenticated user can still use normal AI chat
  it('4. Authenticated user can successfully use normal AI chat and dynamic insights', async () => {
    const chatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        message: 'Plan my day with high priority focus',
        moduleContext: 'tasks',
        conversationHistory: [
          { role: 'user', content: 'Hello ORIGIN AI' },
          { role: 'assistant', content: 'Greetings Alice, how may I assist you today?' },
        ],
      });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.success).toBe(true);
    expect(chatRes.body.data.reply).toBeDefined();
    expect(Array.isArray(chatRes.body.data.proposedActions)).toBe(true);
    expect(Array.isArray(chatRes.body.data.suggestedFollowups)).toBe(true);

    const insightsRes = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({});

    expect(insightsRes.status).toBe(200);
    expect(insightsRes.body.success).toBe(true);
    expect(Array.isArray(insightsRes.body.data)).toBe(true);
    expect(insightsRes.body.data.length).toBeGreaterThan(0);
  });

  // TEST 5: Unauthenticated user receives 401
  it('5. Unauthenticated user requests receive HTTP 401 Unauthorized', async () => {
    const noTokenChat = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Give me access' });

    expect(noTokenChat.status).toBe(401);
    expect(noTokenChat.body.success).toBe(false);

    const invalidTokenChat = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer invalid_signature_token')
      .send({ message: 'Give me access' });

    expect(invalidTokenChat.status).toBe(401);

    const noTokenInsights = await request(app)
      .post('/api/ai/insights')
      .send({});

    expect(noTokenInsights.status).toBe(401);
  });

  // TEST 6: AI endpoint respects existing rate limits
  it('6. AI endpoint enforces strict rate limits per authenticated user ID', async () => {
    // Exhaust rate limit for User A (limit 30 in server.ts / mock)
    for (let i = 0; i < 30; i++) {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: `Message number ${i}` });
      expect(res.status).toBe(200);
    }

    // 31st request from User A must be blocked with HTTP 429
    const blockedRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ message: 'This should be rate limited' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');

    // User B is unaffected and can still make AI requests
    const userBRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ message: 'Hello from User B' });

    expect(userBRes.status).toBe(200);
    expect(userBRes.body.success).toBe(true);
  });

  // TEST 7: Sensitive server-side user data is not exposed to unauthorized users
  it('7. Sensitive encrypted user notes, finances, and reflections belonging to User B are never decrypted or exposed in User A context', () => {
    const aliceContext = buildServerAuthorizedAIContext(userA.user.id);
    const bobContext = buildServerAuthorizedAIContext(userB.user.id);

    // Alice's note should be properly decrypted for Alice
    expect(aliceContext.notes).toHaveLength(1);
    expect(aliceContext.notes[0].excerpt).toContain('Aurora project');

    // Bob's note should be properly decrypted for Bob
    expect(bobContext.notes).toHaveLength(1);
    expect(bobContext.notes[0].excerpt).toContain('$42,000,000 USD');

    // Verify Bob's secret is never in Alice's context
    const aliceContextStr = JSON.stringify(aliceContext);
    expect(aliceContextStr).not.toContain('$42,000,000');
    expect(aliceContextStr).not.toContain('Bob Confidential');

    // Verify prompt building separates trusted data from conversational input
    const securePrompt = buildSecureAIPrompt({
      trustedContext: aliceContext,
      message: 'What are my top priorities?',
      moduleContext: 'tasks',
    });

    expect(securePrompt).toContain('=== SERVER-VERIFIED AUTHORITATIVE USER DATA ===');
    expect(securePrompt).toContain('Alice Sovereign');
    expect(securePrompt).toContain('Alice Project Aurora Deliverable');
    expect(securePrompt).not.toContain('Bob Confidential');
  });
});
