import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { generateToken } from '../auth';
import { setMockGeminiCaller, setGeminiClientForTesting } from '../ai-controller';
import { resetRateLimitsForTesting, AI_RATE_LIMIT_CONFIG, rateLimiter } from '../rate-limiter';
import { db, UserRecord } from '../db';

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
      headline: `${displayName} Leader`,
      bio: `Bio for ${displayName}`,
      primaryLifeFocus: 'Intentional Living & Performance',
    },
    preferences: {
      theme: 'system',
      timezone: 'UTC',
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

describe('AI Endpoints Server-Side Rate Limiting Integration Suite', () => {
  let userA: { user: UserRecord; token: string };
  let userB: { user: UserRecord; token: string };
  let mockGeminiCalls: Array<{ contents: any; systemInstruction: string }> = [];

  beforeEach(() => {
    resetRateLimitsForTesting();
    mockGeminiCalls = [];

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

    // Mock Gemini Provider to prevent external calls and credit consumption
    setMockGeminiCaller(async (params) => {
      mockGeminiCalls.push(params);
      return {
        text: JSON.stringify({
          reply: 'Here is your daily synthesis based on verified records.',
          suggestedFollowups: ['Check priorities', 'Reflect on habits'],
          proposedActions: [],
          reasoningSummary: 'Grounded in server-verified data.',
        }),
        modelUsed: 'gemini-2.5-flash-mock',
      };
    });

    userA = createTestUser('usr_rate_a', 'user_a@origin.internal', 'User Alpha');
    userB = createTestUser('usr_rate_b', 'user_b@origin.internal', 'User Beta');

    // Add private task for user A
    db.schema.tasks.push({
      id: 'task_a_1',
      userId: userA.user.id,
      title: 'Alpha Deep Work Block',
      priority: 'high',
      status: 'in_progress',
      tags: ['focus'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    setMockGeminiCaller(null);
    setGeminiClientForTesting(null);
    vi.restoreAllMocks();
  });

  // TEST 1: A normal authenticated AI request is allowed
  it('1. A normal authenticated AI request is allowed and includes RateLimit headers', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        message: 'Plan my afternoon focus block.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reply).toBeDefined();
    expect(res.headers['ratelimit-limit']).toBe(AI_RATE_LIMIT_CONFIG.chat.limit.toString());
    expect(res.headers['ratelimit-remaining']).toBe((AI_RATE_LIMIT_CONFIG.chat.limit - 1).toString());
    expect(mockGeminiCalls.length).toBe(1);
  });

  // TEST 2: Repeated requests within the configured limit are allowed
  it('2. Repeated requests within the configured limit are allowed', async () => {
    const totalRequests = 5;
    for (let i = 0; i < totalRequests; i++) {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: `Message number ${i + 1}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Number(res.headers['ratelimit-remaining'])).toBe(AI_RATE_LIMIT_CONFIG.chat.limit - (i + 1));
    }

    expect(mockGeminiCalls.length).toBe(totalRequests);
  });

  // TEST 3: Requests exceeding the limit return HTTP 429
  it('3. Requests exceeding the configured limit return HTTP 429 with Retry-After header', async () => {
    const chatLimit = AI_RATE_LIMIT_CONFIG.chat.limit;

    // Consume all allowed tokens up to the limit
    for (let i = 0; i < chatLimit; i++) {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: `Fill request ${i + 1}` });
      expect(res.status).toBe(200);
    }

    expect(mockGeminiCalls.length).toBe(chatLimit);

    // Request exceeding the limit
    const blockedRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ message: 'Request exceeding rate limit threshold' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');
    expect(blockedRes.body.error.message).toContain('Too many AI requests');
    expect(blockedRes.headers['retry-after']).toBeDefined();
    expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThan(0);
    expect(blockedRes.headers['ratelimit-remaining']).toBe('0');
  });

  // TEST 4: A rate-limited request does NOT call the external AI provider
  it('4. A rate-limited request does NOT call the external AI provider and does not consume quota', async () => {
    const chatLimit = AI_RATE_LIMIT_CONFIG.chat.limit;

    // Fill the bucket
    for (let i = 0; i < chatLimit; i++) {
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: `Message ${i}` });
    }

    const callsBeforeBlock = mockGeminiCalls.length;
    expect(callsBeforeBlock).toBe(chatLimit);

    // Send 3 additional rejected requests
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: `Rejected burst message ${i}` });

      expect(res.status).toBe(429);
    }

    // Call count to external AI provider must remain strictly unchanged
    expect(mockGeminiCalls.length).toBe(callsBeforeBlock);
  });

  // TEST 5: User A's rate limit cannot be bypassed by changing a client-supplied userId
  it('5. User A rate limit cannot be bypassed by changing client-supplied userId or headers', async () => {
    const chatLimit = AI_RATE_LIMIT_CONFIG.chat.limit;

    // Exhaust User A's limit
    for (let i = 0; i < chatLimit; i++) {
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: `Message ${i}` });
    }

    // Attempt to bypass by sending userB's id in body and custom spoof headers
    const bypassAttempt = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`) // Token is still User A
      .set('x-user-id', userB.user.id)
      .send({
        userId: userB.user.id,
        targetUserId: userB.user.id,
        message: 'Trying to bypass rate limit with spoofed userId',
      });

    // Still blocked because rate limit is keyed strictly by the verified JWT userId
    expect(bypassAttempt.status).toBe(429);
    expect(bypassAttempt.body.error.code).toBe('RATE_LIMITED');
  });

  // TEST 6: User B has an independent rate-limit identity
  it('6. User B has an independent rate-limit identity and is not affected when User A is blocked', async () => {
    const chatLimit = AI_RATE_LIMIT_CONFIG.chat.limit;

    // Exhaust User A's limit
    for (let i = 0; i < chatLimit; i++) {
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: `Exhaust User A ${i}` });
    }

    // User A is blocked
    const userABlocked = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ message: 'User A blocked attempt' });
    expect(userABlocked.status).toBe(429);

    // User B sends an AI request - MUST SUCCEED with full quota
    const userBRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ message: 'User B fresh request' });

    expect(userBRes.status).toBe(200);
    expect(userBRes.body.success).toBe(true);
    expect(userBRes.headers['ratelimit-remaining']).toBe((AI_RATE_LIMIT_CONFIG.chat.limit - 1).toString());
  });

  // TEST 7: Unauthenticated requests remain rejected
  it('7. Unauthenticated requests to /api/ai/chat and /api/ai/insights remain rejected with 401', async () => {
    const unauthChat = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Anonymous attempt' });

    expect(unauthChat.status).toBe(401);
    expect(unauthChat.body.success).toBe(false);
    expect(unauthChat.body.error.code).toBe('UNAUTHORIZED');

    const unauthInsights = await request(app)
      .post('/api/ai/insights')
      .send({});

    expect(unauthInsights.status).toBe(401);
    expect(unauthInsights.body.success).toBe(false);
    expect(unauthInsights.body.error.code).toBe('UNAUTHORIZED');

    expect(mockGeminiCalls.length).toBe(0);
  });

  // TEST 8: Existing valid AI behavior remains intact for /api/ai/insights rate limiting
  it('8. Existing valid AI behavior remains intact and rate limits /api/ai/insights independently', async () => {
    setMockGeminiCaller(async (params) => {
      mockGeminiCalls.push(params);
      return {
        text: JSON.stringify([
          {
            id: 'ins_1',
            title: 'Deep Work Consistency',
            domain: 'productivity',
            type: 'positive_trend',
            observedData: [{ label: 'Focus Blocks', value: '4/day' }],
            interpretation: 'Consistent focus blocks maximize high-value output.',
            actionableStep: 'Schedule afternoon focus routines.',
          },
        ]),
        modelUsed: 'gemini-2.5-flash-mock',
      };
    });

    const insightsLimit = AI_RATE_LIMIT_CONFIG.insights.limit;

    // Normal request allowed
    const validInsights = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ focusArea: 'productivity' });

    expect(validInsights.status).toBe(200);
    expect(validInsights.body.success).toBe(true);
    expect(Array.isArray(validInsights.body.data)).toBe(true);
    expect(validInsights.headers['ratelimit-limit']).toBe(insightsLimit.toString());

    // Exhaust remaining insights limit
    for (let i = 1; i < insightsLimit; i++) {
      const res = await request(app)
        .post('/api/ai/insights')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ focusArea: 'productivity' });
      expect(res.status).toBe(200);
    }

    // Next request is 429
    const blockedInsights = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ focusArea: 'productivity' });

    expect(blockedInsights.status).toBe(429);
    expect(blockedInsights.body.error.code).toBe('RATE_LIMITED');
    expect(blockedInsights.body.error.message).toContain('Too many AI insights requests');
  });

  // TEST 9: Response on 429 does not leak secrets, API keys, or internal memory structures
  it('9. Rate limit error responses never leak secrets or internal state', async () => {
    // Fill limit
    for (let i = 0; i < AI_RATE_LIMIT_CONFIG.chat.limit; i++) {
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ message: 'Request' });
    }

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ message: 'Exceeding' });

    expect(res.status).toBe(429);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('store');
    expect(bodyStr).not.toContain('Map');
    expect(bodyStr).not.toContain('secret');
    expect(bodyStr).not.toContain('key');
  });
});
