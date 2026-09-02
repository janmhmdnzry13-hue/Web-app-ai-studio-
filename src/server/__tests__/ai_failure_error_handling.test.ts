import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { generateToken } from '../auth';
import {
  setMockGeminiCaller,
  setGeminiClientForTesting,
  setDisableLocalFallbackForTesting,
  setAITimeoutForTesting,
  PRIMARY_GEMINI_MODEL,
} from '../ai-controller';
import { resetRateLimitsForTesting } from '../rate-limiter';
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
      primaryLifeFocus: 'Performance & Organization',
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

describe('AI Provider Failure & Error Handling Integration Test Suite', () => {
  let user: { user: UserRecord; token: string };

  beforeEach(() => {
    resetRateLimitsForTesting();
    setDisableLocalFallbackForTesting(false);
    setAITimeoutForTesting(null);

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

    user = createTestUser('usr_ai_fail_1', 'user.fail@origin.internal', 'Test User');
  });

  afterEach(() => {
    setMockGeminiCaller(null);
    setGeminiClientForTesting(null);
    setDisableLocalFallbackForTesting(false);
    setAITimeoutForTesting(null);
    vi.restoreAllMocks();
  });

  // TEST 1: Successful AI provider response -> normal successful response
  it('1. Successful AI provider response returns normal successful response without fallback flag', async () => {
    setMockGeminiCaller(async () => ({
      text: JSON.stringify({
        reply: 'Strategic plan synthesized from server records.',
        suggestedFollowups: ['Review tasks'],
        proposedActions: [],
        reasoningSummary: 'Grounded in user context.',
      }),
      modelUsed: PRIMARY_GEMINI_MODEL,
    }));

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Help me plan my day' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reply).toBe('Strategic plan synthesized from server records.');
    expect(res.body.provider).toBe(PRIMARY_GEMINI_MODEL);
    expect(res.body.fallbackUsed).toBeUndefined();
  });

  // TEST 2: AI provider timeout -> controlled failure
  it('2. AI provider timeout produces controlled failure (HTTP 504 when fallback disabled or safe fallback when enabled)', async () => {
    // Test with timeout and fallback disabled
    setDisableLocalFallbackForTesting(true);
    setAITimeoutForTesting(100); // 100ms timeout

    setMockGeminiCaller(async () => {
      // Simulate slow/hanging provider
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { text: '{}', modelUsed: PRIMARY_GEMINI_MODEL };
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Long running query' });

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_PROVIDER_TIMEOUT');
    expect(res.body.error.message).toContain('timed out');
  });

  // TEST 3: AI provider HTTP error -> controlled failure
  it('3. AI provider HTTP error produces controlled failure and does not claim fake success', async () => {
    setDisableLocalFallbackForTesting(true);

    setMockGeminiCaller(async () => {
      const httpErr: any = new Error('503 Service Unavailable: High load on provider cluster');
      httpErr.statusCode = 503;
      throw httpErr;
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Query during provider outage' });

    expect([502, 503]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_PROVIDER_ERROR');
    expect(res.body.error.message).toBeDefined();
  });

  // TEST 4: Empty provider response -> handled safely
  it('4. Empty provider response is handled safely and does not crash or return empty text to user', async () => {
    setDisableLocalFallbackForTesting(true);

    setMockGeminiCaller(async () => ({
      text: '   ', // whitespace only
      modelUsed: PRIMARY_GEMINI_MODEL,
    }));

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Query resulting in empty response' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_EMPTY_RESPONSE');
  });

  // TEST 5: Malformed provider response -> handled safely
  it('5. Malformed provider response is handled safely without crashing JSON parser', async () => {
    setDisableLocalFallbackForTesting(true);

    setMockGeminiCaller(async () => ({
      text: '<<< Not valid JSON or markdown >>>',
      modelUsed: PRIMARY_GEMINI_MODEL,
    }));

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Query returning corrupt json' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_RESPONSE_MALFORMED');
  });

  // TEST 6: No AI provider credentials appear in the response
  it('6. Error responses never expose API keys or credentials', async () => {
    setDisableLocalFallbackForTesting(true);

    // Mock an error message that might contain a secret or key
    setMockGeminiCaller(async () => {
      throw new Error('Failed connecting to https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyA_SECRET_KEY_12345');
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Security check' });

    const rawResponse = JSON.stringify(res.body);
    expect(rawResponse).not.toContain('AIzaSyA_SECRET_KEY_12345');
    expect(rawResponse).not.toContain('key=');
  });

  // TEST 7: No stack trace appears in the response
  it('7. Error responses never leak stack traces or internal server paths', async () => {
    setDisableLocalFallbackForTesting(true);

    setMockGeminiCaller(async () => {
      const err = new Error('Simulated internal stack explosion');
      err.stack = 'Error: Simulated\n    at executeGeminiContentGeneration (/app/src/server/ai-controller.ts:75:11)\n    at Object.handleAiChat';
      throw err;
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Stack trace check' });

    const rawResponse = JSON.stringify(res.body);
    expect(rawResponse).not.toContain('/app/src/server');
    expect(rawResponse).not.toContain('executeGeminiContentGeneration');
    expect(rawResponse).not.toContain('at Object.handleAiChat');
    expect(res.body.error).toBeDefined();
    expect(res.body.stack).toBeUndefined();
  });

  // TEST 8: No infinite retry occurs
  it('8. Bounded retry occurs at most once across fallback models and never loops infinitely', async () => {
    let callCount = 0;
    setMockGeminiCaller(async () => {
      callCount++;
      throw new Error('Provider down');
    });

    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Retry test' });

    // With mock caller or primary/secondary model loop, it must be bounded (1 for mock caller)
    expect(callCount).toBe(1);
  });

  // TEST 9: If local fallback exists and is intentionally used, the response clearly identifies the fallback
  it('9. When local fallback engine is used, response clearly identifies provider: local-fallback and fallbackUsed: true', async () => {
    // Fallback enabled (default)
    setDisableLocalFallbackForTesting(false);

    setMockGeminiCaller(async () => {
      throw new Error('External provider unavailable');
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Focus planning' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.provider).toBe('local-fallback');
    expect(res.body.fallbackUsed).toBe(true);
    expect(res.body.data.reply).toBeDefined();
    expect(res.body.warning).toBeDefined();
  });

  // TEST 10: If no usable response exists, the API does not return fake success
  it('10. If no usable response exists, API returns HTTP 502/503/504 error instead of fake success', async () => {
    setDisableLocalFallbackForTesting(true);

    setMockGeminiCaller(async () => {
      throw new Error('Connection refused by provider host');
    });

    const res = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_PROVIDER_ERROR');
    expect(res.body.data).toBeUndefined();
  });
});
