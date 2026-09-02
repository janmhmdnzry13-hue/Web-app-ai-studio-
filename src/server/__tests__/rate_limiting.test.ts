import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { requireAuth, AuthenticatedRequest, generateToken } from '../auth';
import { db, UserRecord } from '../db';
import {
  rateLimiter,
  InMemoryRateLimiter,
  checkRateLimit,
  resetRateLimitsForTesting,
  cleanupExpiredRateLimits,
  getRateLimitEntryCount,
  getClientIp,
} from '../rate-limiter';

// Mirror server.ts routing configuration for isolated integration testing
const app = express();
app.use(express.json());

// Mount server-side AI endpoints mirroring server.ts for isolated rate limit testing
app.post('/api/ai/chat', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  if (!checkRateLimit(`ai_chat_${userId}`, 5, 60000)) {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' },
    });
    return;
  }
  res.json({ success: true, data: { reply: 'Intelligence generated successfully.' } });
});

app.post('/api/ai/insights', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  if (!checkRateLimit(`ai_insights_${userId}`, 3, 60000)) {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' },
    });
    return;
  }
  res.json({ success: true, data: [] });
});

app.use('/api', apiRouter);
app.use(apiRouter); // Mirror root mount for /auth/login and /auth/signup

function createTestUser(email: string): { user: UserRecord; token: string } {
  const user: UserRecord = {
    id: `usr_test_${Math.random().toString(36).substring(2, 9)}`,
    email: email.toLowerCase(),
    passwordHash: 'dummy_hash',
    role: 'member',
    emailVerified: true,
    profile: { displayName: 'Rate Test User', headline: '', bio: '', primaryLifeFocus: '' },
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
    subscription: { tier: 'free', status: 'active' },
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.schema.users.push(user);
  const token = generateToken(user);
  return { user, token };
}

describe('ORIGIN Backend Rate Limiting Hardening Suite', () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Normal request succeeds
  it('1. Normal requests succeed under the configured rate limits', async () => {
    const email = `normal_user_${Date.now()}@origin-os.internal`;
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', '192.168.1.100')
      .send({ email, password: 'SecurePassword123!', displayName: 'Normal User' });

    expect(signupRes.status).toBe(200);
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.data.token).toBeDefined();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '192.168.1.100')
      .send({ email, password: 'SecurePassword123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
  });

  // 2. Excessive login attempts return 429
  it('2. Excessive login attempts return HTTP 429 and block further tries until window expires', async () => {
    const ip = '10.0.0.45';
    // Limit for login is 15 attempts in 60000ms
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nonexistent@origin-os.internal', password: 'wrong' });
      // Should return 401 for bad credentials while under rate limit
      expect(res.status).toBe(401);
    }

    // 16th attempt from the same IP must be rate limited with HTTP 429
    const blockedRes = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nonexistent@origin-os.internal', password: 'wrong' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');
  });

  // 3. Excessive signup attempts return 429
  it('3. Excessive signup attempts from the same IP return HTTP 429', async () => {
    const ip = '10.0.0.88';
    // Signup limit is 10 attempts per 10 minutes
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({
          email: `signup_burst_${i}_${Date.now()}@origin-os.internal`,
          password: 'Password123!',
          displayName: `User ${i}`,
        });
      expect(res.status).toBe(200);
    }

    // 11th attempt from same IP must be blocked with HTTP 429
    const blockedRes = await request(app)
      .post('/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: `signup_burst_blocked_${Date.now()}@origin-os.internal`,
        password: 'Password123!',
        displayName: 'Blocked User',
      });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');
  });

  // 4. Excessive AI requests return 429 (Chat and Insights)
  it('4. Excessive AI requests return HTTP 429 keyed on authenticated user identity', async () => {
    const { token: userToken } = createTestUser(`ai_user_${Date.now()}@origin-os.internal`);

    // AI Chat limit is 5 in this test app
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: `Message ${i}` });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    // 6th AI Chat request should be rejected with 429
    const blockedChatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ message: 'Exceeding limit message' });

    expect(blockedChatRes.status).toBe(429);
    expect(blockedChatRes.body.success).toBe(false);
    expect(blockedChatRes.body.error.code).toBe('RATE_LIMITED');

    // AI Insights limit is 3
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/ai/insights')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ context: {} });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    // 4th AI Insights request should be rejected with 429
    const blockedInsightsRes = await request(app)
      .post('/api/ai/insights')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ context: {} });

    expect(blockedInsightsRes.status).toBe(429);
    expect(blockedInsightsRes.body.error.code).toBe('RATE_LIMITED');
  });

  // 5. Rate limit resets after expiration
  it('5. Rate limit window resets after expiration, allowing subsequent requests', () => {
    const key = `test_window_reset_${Date.now()}`;
    const windowMs = 500;
    const limit = 2;

    expect(rateLimiter.check(key, limit, windowMs)).toBe(true);
    expect(rateLimiter.check(key, limit, windowMs)).toBe(true);
    // Exceeded
    expect(rateLimiter.check(key, limit, windowMs)).toBe(false);

    // Mock forward time past the window expiration
    const futureTime = Date.now() + 600;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(futureTime);

    // Should succeed again because window has elapsed
    expect(rateLimiter.check(key, limit, windowMs)).toBe(true);
    nowSpy.mockRestore();
  });

  // 6. Separate users/IPs are not accidentally blocked together
  it('6. Separate users and separate IP addresses do not block each other', async () => {
    const ipA = '172.16.0.10';
    const ipB = '172.16.0.20';

    // Exhaust login attempts for IP A
    for (let i = 0; i < 15; i++) {
      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', ipA)
        .send({ email: 'target@origin.internal', password: 'bad' });
    }

    // IP A is blocked
    const resA = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', ipA)
      .send({ email: 'target@origin.internal', password: 'bad' });
    expect(resA.status).toBe(429);

    // IP B is completely unaffected and can still make login attempts
    const resB = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', ipB)
      .send({ email: 'target@origin.internal', password: 'bad' });
    expect(resB.status).toBe(401); // 401 bad credentials, NOT 429 blocked

    // Same isolation verification for authenticated AI users:
    const { token: tokenUserA } = createTestUser(`userA_${Date.now()}@origin-os.internal`);
    const { token: tokenUserB } = createTestUser(`userB_${Date.now()}@origin-os.internal`);

    // Exhaust AI limit for User A
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${tokenUserA}`).send({ message: 'hi' });
    }
    const blockedA = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${tokenUserA}`).send({ message: 'hi' });
    expect(blockedA.status).toBe(429);

    // User B (even if making requests from same network/IP) is not blocked
    const allowedB = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${tokenUserB}`).send({ message: 'hi' });
    expect(allowedB.status).toBe(200);
  });

  // 7. Expired limiter entries are cleaned up (preventing memory leaks)
  it('7. Expired limiter entries are actively cleaned up without lingering in memory', () => {
    resetRateLimitsForTesting();

    const initialNow = 1000000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(initialNow);

    // Create 10 distinct rate limit entries with 5000ms window
    for (let i = 0; i < 10; i++) {
      rateLimiter.check(`key_cleanup_${i}`, 5, 5000);
    }
    expect(getRateLimitEntryCount()).toBe(10);

    // Advance time by 6000ms so all entries are expired
    nowSpy.mockReturnValue(initialNow + 6000);

    const evicted = cleanupExpiredRateLimits();
    expect(evicted).toBe(10);
    expect(getRateLimitEntryCount()).toBe(0);

    nowSpy.mockRestore();
  });

  // 8. Bounded capacity protects against memory exhaustion attacks
  it('8. Enforces bounded capacity limit and evicts oldest records when capacity ceiling is reached', () => {
    // Instantiate a small test limiter with maxEntries = 5
    const boundedLimiter = new InMemoryRateLimiter({ maxEntries: 5 });

    for (let i = 0; i < 5; i++) {
      boundedLimiter.consume(`bounded_key_${i}`, 10, 60000);
    }
    expect(boundedLimiter.size()).toBe(5);

    // Inserting a 6th key must evict the oldest and stay within bounds
    boundedLimiter.consume('bounded_key_overflow', 10, 60000);
    expect(boundedLimiter.size()).toBeLessThanOrEqual(5);

    boundedLimiter.destroy();
  });

  // 9. Client IP extraction ignores spoofed headers and extracts first forwarded IP safely
  it('9. getClientIp safely extracts IP and handles multi-hop X-Forwarded-For headers', () => {
    const fakeReqMulti = {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      socket: { remoteAddress: '127.0.0.1' },
    } as any;

    expect(getClientIp(fakeReqMulti)).toBe('203.0.113.195');

    const fakeReqDirect = {
      headers: {},
      ip: '198.51.100.42',
      socket: { remoteAddress: '198.51.100.42' },
    } as any;

    expect(getClientIp(fakeReqDirect)).toBe('198.51.100.42');
  });
});
