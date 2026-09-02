import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { apiRouter } from '../routes';
import { db } from '../db';
import { rateLimiter, resetRateLimitsForTesting } from '../rate-limiter';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Signup Endpoint Rate Limiting & Abuse Prevention Suite', () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
    db.schema.users = [];
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TEST 1: A normal signup succeeds
  it('1. A normal signup succeeds', async () => {
    const email = `legit_user_${Date.now()}@origin-os.internal`;
    const res = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({
        email,
        password: 'StrongPassword123!',
        displayName: 'Legitimate User',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.profile.displayName).toBe('Legitimate User');
    expect(res.body.data.token).toBeDefined();
    expect(res.headers['ratelimit-limit']).toBe('10');
    expect(res.headers['ratelimit-remaining']).toBe('9');
  });

  // TEST 2: Repeated signup attempts within the limit are handled normally
  it('2. Repeated signup attempts within the limit are handled normally', async () => {
    const ip = '203.0.113.25';

    for (let i = 1; i <= 5; i++) {
      const email = `user_within_limit_${i}_${Date.now()}@origin-os.internal`;
      const res = await request(app)
        .post('/api/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({
          email,
          password: 'StrongPassword123!',
          displayName: `User ${i}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['ratelimit-remaining']).toBe((10 - i).toString());
    }
  });

  // TEST 3: Excessive signup attempts return HTTP 429
  it('3. Excessive signup attempts return HTTP 429', async () => {
    const ip = '203.0.113.50';

    // Exhaust the 10-attempt limit
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({
          email: `spam_user_${i}_${Date.now()}@origin-os.internal`,
          password: 'StrongPassword123!',
          displayName: `Spam User ${i}`,
        });
      expect(res.status).toBe(200);
    }

    // 11th attempt must be rejected with HTTP 429 Rate Limited
    const blockedRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: `spam_user_blocked_${Date.now()}@origin-os.internal`,
        password: 'StrongPassword123!',
        displayName: 'Blocked Spam User',
      });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');
    expect(blockedRes.headers['retry-after']).toBeDefined();
    expect(blockedRes.headers['ratelimit-remaining']).toBe('0');
  });

  // TEST 4: The rate limit resets after its configured window
  it('4. The rate limit resets after its configured window', async () => {
    const ip = '203.0.113.75';
    const baseTime = 1700000000000;
    let currentTime = baseTime;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    // Consume all 10 tokens at baseTime
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({
          email: `burst_user_${i}_${Date.now()}@origin-os.internal`,
          password: 'StrongPassword123!',
          displayName: `Burst User ${i}`,
        });
      expect(res.status).toBe(200);
    }

    // Immediately after, attempt 11 is blocked
    const blockedRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: `burst_user_blocked_${Date.now()}@origin-os.internal`,
        password: 'StrongPassword123!',
        displayName: 'Burst Blocked User',
      });
    expect(blockedRes.status).toBe(429);

    // Advance time by 10 minutes + 1 second (window expired)
    currentTime = baseTime + (10 * 60 * 1000) + 1000;

    // After window expires, signup must be permitted again
    const postResetRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: `fresh_window_user_${Date.now()}@origin-os.internal`,
        password: 'StrongPassword123!',
        displayName: 'Fresh Window User',
      });

    expect(postResetRes.status).toBe(200);
    expect(postResetRes.body.success).toBe(true);
    expect(postResetRes.body.data.user.email).toContain('fresh_window_user');

    nowSpy.mockRestore();
  });

  // TEST 5: Changing a client-supplied userId cannot bypass the rate limit
  it('5. Changing a client-supplied userId cannot bypass the rate limit', async () => {
    const ip = '203.0.113.99';

    // Exhaust 10 requests from this IP with varying spoofed userIds
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('X-Forwarded-For', ip)
        .set('X-User-Id', `spoofed_header_usr_${i}`)
        .send({
          userId: `spoofed_body_usr_${i}`,
          id: `spoofed_id_${i}`,
          email: `spoof_user_${i}_${Date.now()}@origin-os.internal`,
          password: 'StrongPassword123!',
          displayName: `Spoofer ${i}`,
        });
      expect(res.status).toBe(200);
    }

    // 11th request attempting different client-supplied userId must STILL be blocked
    const bypassAttempt = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .set('X-User-Id', 'different_spoofed_header_usr_999')
      .send({
        userId: 'brand_new_fake_id_12345',
        id: 'brand_new_fake_id_67890',
        email: `spoofer_bypass_${Date.now()}@origin-os.internal`,
        password: 'StrongPassword123!',
        displayName: 'Spoofer Trying Bypass',
      });

    expect(bypassAttempt.status).toBe(429);
    expect(bypassAttempt.body.success).toBe(false);
    expect(bypassAttempt.body.error.code).toBe('RATE_LIMITED');
  });

  // TEST 6: Existing signup validation and password hashing still work
  it('6. Existing signup validation and password hashing still work', async () => {
    const ip = '203.0.113.120';

    // A. Validation: Invalid email format rejected with 400
    const invalidEmailRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: 'invalid-email-without-at',
        password: 'ValidPassword123!',
        displayName: 'Test User',
      });
    expect(invalidEmailRes.status).toBe(400);
    expect(invalidEmailRes.body.error.code).toBe('INVALID_EMAIL');

    // B. Validation: Short password (< 6 chars) rejected with 400
    const shortPasswordRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: 'test_short_pw@origin-os.internal',
        password: '123',
        displayName: 'Test User',
      });
    expect(shortPasswordRes.status).toBe(400);
    expect(shortPasswordRes.body.error.code).toBe('INVALID_PASSWORD');

    // C. Validation: Missing display name rejected with 400
    const missingNameRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: 'test_missing_name@origin-os.internal',
        password: 'ValidPassword123!',
        displayName: '   ',
      });
    expect(missingNameRes.status).toBe(400);
    expect(missingNameRes.body.error.code).toBe('INVALID_NAME');

    // D. Valid signup properly hashes password with bcrypt
    const validEmail = 'security_verified_user@origin-os.internal';
    const plainPassword = 'SuperSecretPassword2026!';
    const validRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: validEmail,
        password: plainPassword,
        displayName: 'Crypto Verified User',
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.data.user.passwordHash).toBeUndefined();

    // Verify in database: password is truly hashed with bcrypt
    const storedUser = db.schema.users.find((u) => u.email === validEmail);
    expect(storedUser).toBeDefined();
    expect(storedUser!.passwordHash).not.toBe(plainPassword);
    expect(storedUser!.passwordHash.startsWith('$2')).toBe(true);
    expect(bcrypt.compareSync(plainPassword, storedUser!.passwordHash)).toBe(true);

    // E. Duplicate signup rejected with 409
    const duplicateRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: validEmail,
        password: plainPassword,
        displayName: 'Duplicate User',
      });
    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('AUTH_EMAIL_EXISTS');
  });

  // TEST 7: Rate-limited requests do not create accounts, write to the database, or hash passwords
  it('7. Rate-limited requests do not create accounts, write to the database, or hash passwords', async () => {
    const ip = '203.0.113.140';
    const hashSpy = vi.spyOn(bcrypt, 'hashSync');

    // Consume all 10 tokens
    for (let i = 1; i <= 10; i++) {
      await request(app)
        .post('/api/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({
          email: `user_before_limit_${i}_${Date.now()}@origin-os.internal`,
          password: 'Password123!',
          displayName: `User ${i}`,
        });
    }

    const userCountBeforeBlocked = db.schema.users.length;
    expect(userCountBeforeBlocked).toBe(10);
    const hashCountBeforeBlocked = hashSpy.mock.calls.length;

    // Send rate-limited attempt
    const blockedEmail = `blocked_user_${Date.now()}@origin-os.internal`;
    const blockedRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email: blockedEmail,
        password: 'Password123!',
        displayName: 'Blocked User',
      });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');

    // Verify no user was created
    const foundBlockedUser = db.schema.users.find((u) => u.email === blockedEmail);
    expect(foundBlockedUser).toBeUndefined();
    expect(db.schema.users.length).toBe(userCountBeforeBlocked);

    // Verify bcrypt hashing was NOT invoked for the rate-limited request
    expect(hashSpy.mock.calls.length).toBe(hashCountBeforeBlocked);
  });

  // TEST 8: Different legitimate request identities (IPs) are handled independently
  it('8. Different legitimate request identities are handled independently', async () => {
    const ipA = '198.51.100.10';
    const ipB = '198.51.100.20';

    // Exhaust rate limit for IP A
    for (let i = 1; i <= 10; i++) {
      const resA = await request(app)
        .post('/api/auth/signup')
        .set('X-Forwarded-For', ipA)
        .send({
          email: `ip_a_user_${i}_${Date.now()}@origin-os.internal`,
          password: 'Password123!',
          displayName: `IP A User ${i}`,
        });
      expect(resA.status).toBe(200);
    }

    // 11th request from IP A is blocked
    const blockedA = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ipA)
      .send({
        email: `ip_a_blocked_${Date.now()}@origin-os.internal`,
        password: 'Password123!',
        displayName: 'IP A Blocked',
      });
    expect(blockedA.status).toBe(429);

    // IP B must NOT be blocked and can sign up successfully
    const successB = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ipB)
      .send({
        email: `ip_b_user_1_${Date.now()}@origin-os.internal`,
        password: 'Password123!',
        displayName: 'IP B User 1',
      });

    expect(successB.status).toBe(200);
    expect(successB.body.success).toBe(true);
    expect(successB.headers['ratelimit-remaining']).toBe('9');
  });

  // TEST 9: Existing authentication and login behavior remain unchanged
  it('9. Existing authentication and login behavior remain unchanged', async () => {
    const ip = '198.51.100.50';
    const email = `auth_test_${Date.now()}@origin-os.internal`;
    const password = 'AuthPassword2026!';

    // Signup user
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({
        email,
        password,
        displayName: 'Auth Test User',
      });
    expect(signupRes.status).toBe(200);
    const token = signupRes.body.data.token;
    expect(token).toBeDefined();

    // Verify created user can authenticate and retrieve profile
    const profileRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.email).toBe(email);

    // Verify user can log in with their credentials via /api/auth/login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password,
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();

    // Verify invalid password fails login with 401
    const invalidLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password: 'WrongPassword!',
      });
    expect(invalidLoginRes.status).toBe(401);
    expect(invalidLoginRes.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});
