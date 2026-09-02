import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { apiRouter } from '../routes';
import { generateToken, getJwtSecret } from '../auth';
import { setMockGeminiCaller, setGeminiClientForTesting } from '../ai-controller';
import { resetRateLimitsForTesting } from '../rate-limiter';
import { db, UserRecord } from '../db';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

function createTestUser(id: string, email: string, displayName: string): { user: UserRecord; token: string } {
  const user: UserRecord = {
    id,
    email: email.toLowerCase(),
    passwordHash: 'dummy_hash_for_test',
    role: 'member',
    emailVerified: true,
    profile: { displayName, headline: 'AI Test User', bio: '', primaryLifeFocus: 'Intentional Living' },
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

describe('AI Endpoints Server-Side Authentication Protection (/api/ai/chat & /api/ai/insights)', () => {
  let testUser: UserRecord;
  let authToken: string;
  let mockGeminiCalls: Array<{ contents: any; systemInstruction: string }> = [];

  beforeEach(() => {
    resetRateLimitsForTesting();
    mockGeminiCalls = [];

    // Clear db schema collections
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

    // Setup mock Gemini caller to avoid external network calls and quota consumption
    setMockGeminiCaller(async (params) => {
      mockGeminiCalls.push(params);
      return {
        text: JSON.stringify({
          reply: 'Here is your personalized schedule based on verified records.',
          suggestedFollowups: ['Review habit cadence', 'Check active goals'],
          proposedActions: [],
          reasoningSummary: 'Grounded in verified user tasks and habits.',
        }),
        modelUsed: 'gemini-2.5-flash-mock',
      };
    });

    const userObj = createTestUser('usr_ai_test_main', 'ai_tester@origin.internal', 'AI Test User');
    testUser = userObj.user;
    authToken = userObj.token;
  });

  afterEach(() => {
    setMockGeminiCaller(null);
    setGeminiClientForTesting(null);
    vi.restoreAllMocks();
  });

  // Requirement 1 & 9: Authenticated request to /api/ai/chat is accepted
  it('1. Authenticated request to /api/ai/chat is accepted and processes AI request', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        message: 'Plan my morning deep work session.',
        conversationHistory: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.reply).toContain('personalized schedule');
    expect(mockGeminiCalls.length).toBe(1);
  });

  // Requirement 4, 7 & 8: Unauthenticated request to /api/ai/chat is rejected and never calls AI provider
  it('2. Unauthenticated request to /api/ai/chat is rejected (401) and does not call AI provider', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({
        message: 'Plan my day without authentication.',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    // Ensure AI provider was NEVER called and quota was not consumed
    expect(mockGeminiCalls.length).toBe(0);
  });

  // Requirement 5, 7 & 8: Invalid token to /api/ai/chat is rejected and never calls AI provider
  it('3. Invalid token to /api/ai/chat is rejected (401) and does not call AI provider', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer invalid_signature_token_abc123')
      .send({
        message: 'Plan my day with fake token.',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
    expect(mockGeminiCalls.length).toBe(0);
  });

  // Requirement 6, 7 & 8: Expired token to /api/ai/chat is rejected and never calls AI provider
  it('3b. Expired token to /api/ai/chat is rejected (401) and does not call AI provider', async () => {
    const expiredToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: testUser.role },
      getJwtSecret(),
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({
        message: 'Plan my day with expired token.',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    expect(mockGeminiCalls.length).toBe(0);
  });

  // Requirement 1 & 9: Authenticated request to /api/ai/insights is accepted
  it('4. Authenticated request to /api/ai/insights is accepted and processes AI request', async () => {
    // Custom mock for insights returning JSON array
    setMockGeminiCaller(async (params) => {
      mockGeminiCalls.push(params);
      return {
        text: JSON.stringify([
          {
            id: 'ins_1',
            title: 'Consistent Morning Focus',
            domain: 'productivity',
            type: 'positive_trend',
            observedData: [{ label: 'Morning completion', value: '92%' }],
            interpretation: 'Completing deep work in early hours maximizes execution.',
            actionableStep: 'Continue scheduling high-impact tasks before noon.',
          },
        ]),
        modelUsed: 'gemini-2.5-flash-mock',
      };
    });

    const res = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        focusArea: 'productivity',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].title).toBe('Consistent Morning Focus');
    expect(mockGeminiCalls.length).toBe(1);
  });

  // Requirement 4, 7 & 8: Unauthenticated request to /api/ai/insights is rejected
  it('5. Unauthenticated request to /api/ai/insights is rejected (401) and does not call AI provider', async () => {
    const res = await request(app)
      .post('/api/ai/insights')
      .send({
        focusArea: 'finances',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockGeminiCalls.length).toBe(0);
  });

  // Requirement 5, 7 & 8: Invalid token to /api/ai/insights is rejected
  it('6. Invalid token to /api/ai/insights is rejected (401) and does not call AI provider', async () => {
    const res = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', 'Bearer forged_token_value_999')
      .send({
        focusArea: 'productivity',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
    expect(mockGeminiCalls.length).toBe(0);
  });

  // Requirement 6, 7 & 8: Expired token to /api/ai/insights is rejected
  it('6b. Expired token to /api/ai/insights is rejected (401) and does not call AI provider', async () => {
    const expiredToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: testUser.role },
      getJwtSecret(),
      { expiresIn: '-10s' }
    );

    const res = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({
        focusArea: 'productivity',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    expect(mockGeminiCalls.length).toBe(0);
  });

  // Requirement 3: Do not trust a client-supplied userId as proof of identity
  it('7. Derives identity strictly from verified token and ignores client-spoofed userId', async () => {
    // Create a second victim user
    const victim = createTestUser('usr_victim_999', 'victim@origin.internal', 'Victim User').user;

    // Add private task for victim in database
    db.schema.tasks.push({
      id: `task_victim_${Date.now()}`,
      userId: victim.id,
      title: 'Confidential Victim Task XYZ',
      status: 'todo',
      priority: 'high',
      tags: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Attacker sends request with testUser token but attempts to spoof victim.id in body and header
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-user-id', victim.id)
      .send({
        message: 'What tasks do I have scheduled?',
        userId: victim.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Verified call: The AI context passed to Gemini must only contain testUser's data, NOT victim's task
    expect(mockGeminiCalls.length).toBe(1);
    const passedPrompt = mockGeminiCalls[0].contents;
    expect(passedPrompt).not.toContain('Confidential Victim Task XYZ');
  });

  // Requirement 11: Error responses do not leak secrets, API keys, or stack traces
  it('8. Authentication failure responses never expose JWT secrets or internal details', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer corrupt.payload.here')
      .send({ message: 'Hello' });

    expect(res.status).toBe(401);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain(getJwtSecret());
    expect(bodyStr).not.toContain('stack');
    expect(bodyStr).not.toContain('secret');
  });
});
