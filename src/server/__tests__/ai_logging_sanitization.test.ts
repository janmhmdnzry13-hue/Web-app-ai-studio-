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
  sanitizeAiLogMessage,
  logAiDiagnostic,
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
      bio: `Confidential bio for ${displayName} with secret health note`,
      primaryLifeFocus: 'Performance & Financial Freedom',
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

describe('AI Sensitive Data Logging & Sanitization Test Suite', () => {
  let user: { user: UserRecord; token: string };
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;
  let capturedLogs: string[] = [];

  beforeEach(() => {
    resetRateLimitsForTesting();
    setDisableLocalFallbackForTesting(false);
    setAITimeoutForTesting(null);

    db.schema.users = [];
    db.schema.tasks = [];
    db.schema.habits = [];
    db.schema.goals = [];
    db.schema.transactions = [];
    db.schema.reflections = [];
    db.schema.notes = [];
    db.schema.relationships = [];
    db.schema.aiMemories = [];

    user = createTestUser('usr_privacy_tester', 'secret_user@example.com', 'Private Agent');

    // Populate sensitive user records in database
    db.schema.tasks.push({
      id: 'tsk_confidential',
      userId: user.user.id,
      title: 'Confidential Acquisition Deal Alpha',
      status: 'in_progress',
      priority: 'urgent',
      estimatedMinutes: 60,
      tags: ['work', 'deal'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.transactions.push({
      id: 'tx_sensitive',
      userId: user.user.id,
      type: 'expense',
      amount: 45000,
      minorUnits: 4500000,
      category: 'legal',
      title: 'Private Legal Defense Retainer Fee $45,000',
      date: '2026-09-01',
      isRecurring: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.schema.notes.push({
      id: 'not_private_journal',
      userId: user.user.id,
      title: 'Top Secret Strategy & Relationship Notes',
      content: 'Personal emotional reflection and password hints for vault',
      tags: ['private', 'confidential'],
      isArchived: false,
      isPinned: true,
      linkedNoteIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    capturedLogs = [];
    const logCollector = (...args: any[]) => {
      capturedLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    };

    logSpy = vi.spyOn(console, 'log').mockImplementation(logCollector);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(logCollector);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(logCollector);
  });

  afterEach(() => {
    setMockGeminiCaller(null);
    setGeminiClientForTesting(null);
    setDisableLocalFallbackForTesting(false);
    setAITimeoutForTesting(null);
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  function getCombinedLogs(): string {
    return capturedLogs.join('\n');
  }

  describe('1. Sanitization Function Unit Tests', () => {
    it('redacts password hashes, reset tokens, and auth tokens from error strings', () => {
      const rawError =
        'Error at $2a$12$e8Y4J7m9oXF1kZ9L4X9Q3uH5N8v7P2y4R6t1W0z9Q8m7L6k5J4h3 with token rst_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d and tok_abcdef0123456789abcdef0123456789';
      const sanitized = sanitizeAiLogMessage(rawError);

      expect(sanitized).not.toContain('$2a$12$e8Y4J7m9oXF1kZ9L4X9Q3uH5N8v7P2y4R6t1W0z9Q8m7L6k5J4h3');
      expect(sanitized).not.toContain('rst_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d');
      expect(sanitized).not.toContain('tok_abcdef0123456789abcdef0123456789');
      expect(sanitized).toContain('[REDACTED_HASH]');
      expect(sanitized).toContain('rst_[REDACTED]');
      expect(sanitized).toContain('tok_[REDACTED]');
    });

    it('redacts Google API keys, Bearer tokens, and JWT strings', () => {
      const rawError =
        'AI provider error AIzaSyD9876543210ZYXWVUTSRQPONMLKJIHGFED with Authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c3JfMTIzIn0.abcdef123456';
      const sanitized = sanitizeAiLogMessage(rawError);

      expect(sanitized).not.toContain('AIzaSyD9876543210ZYXWVUTSRQPONMLKJIHGFED');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c3JfMTIzIn0.abcdef123456');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
      expect(sanitized).toContain('[REDACTED_JWT]');
    });

    it('redacts prompt context sections, email addresses, and monetary values', () => {
      const rawError = `Failed parsing response for prompt:
=== SERVER-VERIFIED USER CONTEXT ===
{
  "tasks": ["Confidential Acquisition Deal Alpha"],
  "finances": { "netBalance": 45000 },
  "user": { "email": "secret_user@example.com" }
}
=== END SERVER-VERIFIED USER CONTEXT ===
[TASKS & EXECUTION]
- Confidential Acquisition Deal Alpha ($45,000)
User email is secret_user@example.com`;

      const sanitized = sanitizeAiLogMessage(rawError);

      expect(sanitized).not.toContain('Confidential Acquisition Deal Alpha');
      expect(sanitized).not.toContain('secret_user@example.com');
      expect(sanitized).not.toContain('$45,000');
      expect(sanitized).toContain('[REDACTED_USER_CONTEXT]');
    });

    it('redacts environment secrets when present in errors', () => {
      const origSecret = process.env.GEMINI_API_KEY;
      try {
        process.env.GEMINI_API_KEY = 'super_secret_production_gemini_key_12345';
        const rawError = 'Failed to connect with key super_secret_production_gemini_key_12345 to endpoint';
        const sanitized = sanitizeAiLogMessage(rawError);

        expect(sanitized).not.toContain('super_secret_production_gemini_key_12345');
        expect(sanitized).toContain('[REDACTED_SECRET]');
      } finally {
        process.env.GEMINI_API_KEY = origSecret;
      }
    });
  });

  describe('2. Successful AI Requests Logging Safety', () => {
    it('does NOT log private user context, notes, or raw request body during successful /api/ai/chat', async () => {
      setMockGeminiCaller(async () => ({
        text: JSON.stringify({
          reply: 'Plan synthesized successfully.',
          suggestedFollowups: ['Next step'],
          proposedActions: [],
          reasoningSummary: 'Verified with database.',
        }),
        modelUsed: PRIMARY_GEMINI_MODEL,
      }));

      const secretUserPrompt = 'My ultra sensitive private search query 998877';

      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${user.token}`)
        .set('x-request-id', 'req_test_logging_1')
        .send({
          message: secretUserPrompt,
        });

      expect(res.status).toBe(200);

      const allLogs = getCombinedLogs();
      // Ensure logs contain safe metadata
      expect(allLogs).toContain('endpoint=/api/ai/chat');
      expect(allLogs).toContain(`userId=${user.user.id}`);
      expect(allLogs).toContain('requestId=req_test_logging_1');
      expect(allLogs).toContain('status=200');

      // Ensure logs DO NOT contain sensitive data
      expect(allLogs).not.toContain(secretUserPrompt);
      expect(allLogs).not.toContain('Confidential Acquisition Deal Alpha');
      expect(allLogs).not.toContain('Personal emotional reflection');
      expect(allLogs).not.toContain('Private Legal Defense Retainer Fee');
      expect(allLogs).not.toContain(user.user.passwordHash);
      expect(allLogs).not.toContain(user.token);
      expect(allLogs).not.toContain('secret_user@example.com');
    });

    it('does NOT log raw financial context or memories during successful /api/ai/insights', async () => {
      setMockGeminiCaller(async () => ({
        text: JSON.stringify([
          {
            id: 'ins_1',
            title: 'Focus Velocity',
            domain: 'productivity',
            type: 'positive_trend',
            observedData: [{ label: 'Metric', value: 'High' }],
            interpretation: 'Strong execution.',
            actionableStep: 'Keep routine.',
          },
        ]),
        modelUsed: PRIMARY_GEMINI_MODEL,
      }));

      const res = await request(app)
        .post('/api/ai/insights')
        .set('Authorization', `Bearer ${user.token}`)
        .set('x-request-id', 'req_test_insights_1')
        .send({});

      expect(res.status).toBe(200);

      const allLogs = getCombinedLogs();
      expect(allLogs).toContain('endpoint=/api/ai/insights');
      expect(allLogs).toContain(`userId=${user.user.id}`);
      expect(allLogs).toContain('status=200');

      expect(allLogs).not.toContain('Confidential Acquisition Deal Alpha');
      expect(allLogs).not.toContain('45000');
      expect(allLogs).not.toContain(user.user.passwordHash);
      expect(allLogs).not.toContain(user.token);
    });
  });

  describe('3. Error Logging Safety (Model Failure, Timeout, Malformed JSON)', () => {
    it('does NOT log prompt, context, or tokens when external model throws an error containing sensitive details', async () => {
      setDisableLocalFallbackForTesting(true);
      setMockGeminiCaller(async () => {
        const sensitiveLeakError = new Error(
          `GoogleGenAI Error: Model rejected prompt containing user details: === SERVER-VERIFIED USER CONTEXT === Confidential Acquisition Deal Alpha token: tok_leak1234567890123456`
        );
        throw sensitiveLeakError;
      });

      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${user.token}`)
        .set('x-request-id', 'req_error_leak_test')
        .send({
          message: 'Plan my confidential day',
        });

      expect(res.status).toBe(502);

      const allLogs = getCombinedLogs();
      expect(allLogs).toContain('endpoint=/api/ai/chat');
      expect(allLogs).toContain(`userId=${user.user.id}`);
      expect(allLogs).toContain('status=502');
      expect(allLogs).toContain('errorCategory=AI_PROVIDER_ERROR');

      // Sensitive leak must be scrubbed
      expect(allLogs).not.toContain('Confidential Acquisition Deal Alpha');
      expect(allLogs).not.toContain('tok_leak1234567890123456');
      expect(allLogs).not.toContain('=== SERVER-VERIFIED USER CONTEXT ===');
    });

    it('does NOT log raw response or private fields when model returns malformed JSON', async () => {
      setDisableLocalFallbackForTesting(true);
      setMockGeminiCaller(async () => ({
        text: `Invalid json with secret notes: Confidential Acquisition Deal Alpha { privatePasswordVaultHint: 1234 }`,
        modelUsed: PRIMARY_GEMINI_MODEL,
      }));

      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          message: 'Analyze my tasks',
        });

      expect(res.status).toBe(502);

      const allLogs = getCombinedLogs();
      expect(allLogs).toContain('errorCategory=AI_RESPONSE_MALFORMED');
      expect(allLogs).not.toContain('privatePasswordVaultHint');
      expect(allLogs).not.toContain('Confidential Acquisition Deal Alpha');
    });

    it('does NOT log credentials or request body on rate limiting', async () => {
      // Consume all tokens
      for (let i = 0; i < 30; i++) {
        setMockGeminiCaller(async () => ({
          text: JSON.stringify({ reply: 'ok' }),
          modelUsed: PRIMARY_GEMINI_MODEL,
        }));
        await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ message: 'Request ' + i });
      }

      capturedLogs = []; // Reset logs to check the 31st attempt
      const rateLimitedRes = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ message: 'Secret overflow request body 999' });

      expect(rateLimitedRes.status).toBe(429);

      const allLogs = getCombinedLogs();
      expect(allLogs).toContain('errorCategory=RATE_LIMITED');
      expect(allLogs).toContain('status=429');
      expect(allLogs).toContain(`userId=${user.user.id}`);
      expect(allLogs).not.toContain('Secret overflow request body 999');
      expect(allLogs).not.toContain(user.token);
    });
  });
});
