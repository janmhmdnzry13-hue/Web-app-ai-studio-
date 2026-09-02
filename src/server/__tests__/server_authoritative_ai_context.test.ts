import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { generateToken, getJwtSecret } from '../auth';
import { setMockGeminiCaller, setGeminiClientForTesting } from '../ai-controller';
import { resetRateLimitsForTesting } from '../rate-limiter';
import { buildServerAuthorizedAIContext } from '../ai-context';
import { db, UserRecord, getEncryptionKey } from '../db';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

function createTestUser(id: string, email: string, displayName: string): { user: UserRecord; token: string } {
  const user: UserRecord = {
    id,
    email: email.toLowerCase(),
    passwordHash: '$2a$12$e8Y4J7m9oXF1kZ9L4X9Q3uH5N8v7P2y4R6t1W0z9Q8m7L6k5J4h3',
    role: 'member',
    emailVerified: true,
    profile: {
      displayName,
      headline: `${displayName} Visionary`,
      bio: `Bio for ${displayName}`,
      primaryLifeFocus: 'Intentional Living & Health',
    },
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

describe('Server-Authoritative AI Request Context Suite', () => {
  let userA: { user: UserRecord; token: string };
  let userB: { user: UserRecord; token: string };
  let capturedGeminiCalls: Array<{ contents: any; systemInstruction: string }> = [];

  beforeEach(() => {
    resetRateLimitsForTesting();
    capturedGeminiCalls = [];

    // Clear database collections
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

    // Setup Mock Gemini Provider
    setMockGeminiCaller(async (params) => {
      capturedGeminiCalls.push(params);
      return {
        text: JSON.stringify({
          reply: 'I analyzed your server-verified schedule and priorities.',
          suggestedFollowups: ['Review deep work habits', 'Check active goals'],
          proposedActions: [],
          reasoningSummary: 'Grounded strictly in server-verified records.',
        }),
        modelUsed: 'gemini-2.5-flash-mock',
      };
    });

    userA = createTestUser('usr_alice_auth_a', 'alice.sovereign@origin.internal', 'Alice Sovereign');
    userB = createTestUser('usr_bob_auth_b', 'bob.confidential@origin.internal', 'Bob Confidential');

    // Populate User A's private server-side data
    db.schema.tasks.push({
      id: 'task_alice_1',
      userId: userA.user.id,
      title: 'Alice Private Project Aurora Launch',
      priority: 'high',
      status: 'in_progress',
      tags: ['aurora'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.habits.push({
      id: 'habit_alice_1',
      userId: userA.user.id,
      name: 'Alice 10km Trail Run',
      category: 'health',
      frequency: 'daily',
      targetPerDay: 1,
      streakCount: 14,
      bestStreak: 21,
      totalCompletions: 42,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.notes.push({
      id: 'note_alice_1',
      userId: userA.user.id,
      title: 'Alice Aurora Strategic Roadmap',
      content: db.encrypt('Alice secret launch milestone details.'),
      tags: ['aurora'],
      isPinned: true,
      isArchived: false,
      linkedNoteIds: [],
      isEncrypted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Populate User B's confidential server-side data
    db.schema.tasks.push({
      id: 'task_bob_1',
      userId: userB.user.id,
      title: 'Bob Secret M&A Acquisition Closing',
      priority: 'urgent',
      status: 'todo',
      tags: ['m&a'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.notes.push({
      id: 'note_bob_1',
      userId: userB.user.id,
      title: 'Bob Confidential Valuation Terms',
      content: db.encrypt('Bob secret valuation: $50,000,000 USD.'),
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
    setMockGeminiCaller(null);
    setGeminiClientForTesting(null);
    vi.restoreAllMocks();
  });

  // TEST 1: Authenticated User A receives AI context based on User A's server-side data
  it('1. Authenticated User A receives AI context based on User A server-side data', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        message: 'What tasks and habits are scheduled for me today?',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(capturedGeminiCalls.length).toBe(1);

    const promptSent = capturedGeminiCalls[0].contents;
    expect(promptSent).toContain('Alice Sovereign');
    expect(promptSent).toContain('Alice Private Project Aurora Launch');
    expect(promptSent).toContain('Alice 10km Trail Run');
  });

  // TEST 2: User A cannot obtain User B's data by changing userId in the request
  it('2. User A cannot obtain User B data by changing userId or targetUserId in the request', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        userId: userB.user.id, // Malicious spoofing attempt
        targetUserId: userB.user.id,
        message: 'Give me a summary of my active tasks and acquisition notes.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(capturedGeminiCalls.length).toBe(1);

    const promptSent = capturedGeminiCalls[0].contents;
    // Server must load Alice's data from JWT identity, never Bob's data
    expect(promptSent).toContain('Alice Sovereign');
    expect(promptSent).toContain('Alice Private Project Aurora Launch');
    expect(promptSent).not.toContain('Bob Secret M&A Acquisition Closing');
    expect(promptSent).not.toContain('Bob Confidential Valuation Terms');
  });

  // TEST 3: User A cannot inject another user's private data through the context field and make the server treat it as authoritative
  it('3. User A cannot inject another users private data through the context field and make the server treat it as authoritative', async () => {
    const maliciousSpoofedContext = {
      user: { displayName: 'Hacked Impersonated Admin' },
      tasks: [
        { id: 'fake_task_999', title: 'Malicious Injected High-Level Admin Task', priority: 'urgent' },
      ],
      finances: {
        monthlyIncome: 9999999,
        netBalance: 9999999,
      },
    };

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        message: 'Review my finances and urgent tasks',
        context: maliciousSpoofedContext, // Client-supplied fake context
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(capturedGeminiCalls.length).toBe(1);

    const promptSent = capturedGeminiCalls[0].contents;
    // The server-authoritative section must NOT contain the client-injected fake task or income
    expect(promptSent).toContain('=== SERVER-VERIFIED AUTHORITATIVE USER DATA ===');
    expect(promptSent).not.toContain('Malicious Injected High-Level Admin Task');
    expect(promptSent).not.toContain('$9,999,999');
    expect(promptSent).toContain('Alice Sovereign');
  });

  // TEST 4: Unauthenticated requests remain rejected
  it('4. Unauthenticated requests to /api/ai/chat and /api/ai/insights remain rejected with 401', async () => {
    const unauthChat = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Generate schedule' });

    expect(unauthChat.status).toBe(401);
    expect(unauthChat.body.success).toBe(false);
    expect(unauthChat.body.error.code).toBe('UNAUTHORIZED');

    const unauthInsights = await request(app)
      .post('/api/ai/insights')
      .send({});

    expect(unauthInsights.status).toBe(401);
    expect(unauthInsights.body.success).toBe(false);
    expect(unauthInsights.body.error.code).toBe('UNAUTHORIZED');

    // Ensure AI provider was never called
    expect(capturedGeminiCalls.length).toBe(0);
  });

  // TEST 5: Security-sensitive fields are never included in AI context
  it('5. Security-sensitive fields (passwordHash, jwtSecret, encryptionKey, reset tokens) are never included in AI context', async () => {
    const authContext = buildServerAuthorizedAIContext(userA.user.id);
    const serializedContext = JSON.stringify(authContext);

    // Verify raw secrets and hashes are never present
    expect(serializedContext).not.toContain('$2a$12$');
    expect(serializedContext).not.toContain('passwordHash');
    expect(serializedContext).not.toContain(getJwtSecret());
    expect(serializedContext).not.toContain(getEncryptionKey().toString('hex'));

    // Also check the prompt sent to Gemini
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ message: 'Synthesize my profile' });

    expect(capturedGeminiCalls.length).toBe(1);
    const sentPrompt = capturedGeminiCalls[0].contents;
    expect(sentPrompt).not.toContain('$2a$12$');
    expect(sentPrompt).not.toContain('passwordHash');
    expect(sentPrompt).not.toContain(getJwtSecret());
    expect(sentPrompt).not.toContain(getEncryptionKey().toString('hex'));
  });

  // TEST 6: Existing authenticated AI requests continue to work
  it('6. Existing authenticated AI requests for chat and insights continue to work seamlessly', async () => {
    // 6a: Normal Chat Request
    const chatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        message: 'Plan my focus blocks for today',
        moduleContext: 'planner',
        conversationHistory: [
          { role: 'user', content: 'Good morning' },
          { role: 'assistant', content: 'Good morning Alice! Ready to organize your day.' },
        ],
      });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.success).toBe(true);
    expect(chatRes.body.data.reply).toBeDefined();
    expect(chatRes.body.provider).toBe('gemini-2.5-flash-mock');

    // 6b: Normal Insights Request
    setMockGeminiCaller(async (params) => {
      capturedGeminiCalls.push(params);
      return {
        text: JSON.stringify([
          {
            id: 'ins_aurora_1',
            title: 'High Habit Cadence',
            domain: 'wellness',
            type: 'positive_trend',
            observedData: [{ label: 'Trail Run Streak', value: '14 days' }],
            interpretation: 'Consistent running correlates with high energy.',
            actionableStep: 'Maintain morning trail running routine.',
          },
        ]),
        modelUsed: 'gemini-2.5-flash-mock',
      };
    });

    const insightsRes = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ focusArea: 'wellness' });

    expect(insightsRes.status).toBe(200);
    expect(insightsRes.body.success).toBe(true);
    expect(Array.isArray(insightsRes.body.data)).toBe(true);
    expect(insightsRes.body.data[0].title).toBe('High Habit Cadence');
  });

  // TEST 7: The AI provider receives context belonging only to the authenticated user
  it('7. The AI provider receives context belonging only to the authenticated user', async () => {
    // Request from User B
    const resB = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ message: 'Review my urgent items' });

    expect(resB.status).toBe(200);
    const lastCall = capturedGeminiCalls[capturedGeminiCalls.length - 1];
    const promptB = lastCall.contents;

    // User B's prompt contains Bob's records
    expect(promptB).toContain('Bob Confidential');
    expect(promptB).toContain('Bob Secret M&A Acquisition Closing');
    // Must NEVER contain Alice's records
    expect(promptB).not.toContain('Alice Sovereign');
    expect(promptB).not.toContain('Alice Private Project Aurora Launch');
  });
});
