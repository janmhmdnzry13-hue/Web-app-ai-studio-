import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter, checkRateLimit, resetRateLimitsForTesting } from '../routes';
import { requireAuth, AuthenticatedRequest, getJwtSecret } from '../auth';
import { db, getEncryptionKey } from '../db';

// Build a dedicated test app mirroring server.ts configuration
const app = express();
app.use(express.json());
app.use('/api', apiRouter);

// Mount AI routes with identical authentication & rate limiting as server.ts
app.post('/api/ai/chat', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  if (!checkRateLimit(`ai_chat_${userId}`, 30, 60000)) {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many AI requests.' } });
    return;
  }
  res.json({ success: true, reply: 'AI chat response' });
});

app.post('/api/ai/insights', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  if (!checkRateLimit(`ai_insights_${userId}`, 20, 60000)) {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many AI requests.' } });
    return;
  }
  res.json({ success: true, insights: [] });
});

describe('Phase 1 Security & Authentication Hardening Test Suite', () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
  });

  // Test 1: Client cannot register duplicate email
  it('1. Rejects duplicate email registrations with a security error', async () => {
    const email = `test_dup_${Date.now()}@origin-os.internal`;
    const res1 = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'SecurePassword123!', displayName: 'First User' });
    expect(res1.body.success).toBe(true);

    const res2 = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'AnotherPassword456!', displayName: 'Second User' });
    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.code).toBe('AUTH_EMAIL_EXISTS');
  });

  // Test 2: Client receives signed JWT token on valid signup/login
  it('2. Issues valid JWT tokens on successful signup and login', async () => {
    const email = `test_jwt_${Date.now()}@origin-os.internal`;
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'SecurePassword123!', displayName: 'JWT Tester' });
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.data.token).toBeDefined();
    expect(typeof signupRes.body.data.token).toBe('string');
    expect(signupRes.body.data.token.split('.').length).toBe(3); // Standard JWT format: header.payload.signature

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'SecurePassword123!' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeDefined();
    expect(loginRes.body.data.token.split('.').length).toBe(3);
  });

  // Test 3: Password hash is never returned in API responses
  it('3. Never exposes passwordHash or verificationToken in any user/session API response', async () => {
    const email = `test_sanitize_${Date.now()}@origin-os.internal`;
    const password = 'SecurePassword123!';

    // 1. Signup Response
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email, password, displayName: 'Sanitize Tester' });

    expect(signupRes.status).toBe(200);
    expect(signupRes.body.data.user.passwordHash).toBeUndefined();
    expect(signupRes.body.data.user.verificationToken).toBeUndefined();
    expect(JSON.stringify(signupRes.body)).not.toContain('passwordHash');

    const token = signupRes.body.data.token;

    // 2. Login Response
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.passwordHash).toBeUndefined();
    expect(loginRes.body.data.user.verificationToken).toBeUndefined();
    expect(JSON.stringify(loginRes.body)).not.toContain('passwordHash');

    // 3. Current Session Response
    const sessionRes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${token}`);

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.data.user.passwordHash).toBeUndefined();
    expect(sessionRes.body.data.user.verificationToken).toBeUndefined();
    expect(JSON.stringify(sessionRes.body)).not.toContain('passwordHash');

    // 4. Demo Session Response
    const demoRes = await request(app)
      .post('/api/auth/demo')
      .send({});

    expect(demoRes.status).toBe(200);
    expect(demoRes.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(demoRes.body)).not.toContain('passwordHash');

    // 5. Profile Update Response
    const profileRes = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ headline: 'Security Expert' });

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(profileRes.body)).not.toContain('passwordHash');

    // 6. Preferences Update Response
    const prefRes = await request(app)
      .put('/api/users/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark' });

    expect(prefRes.status).toBe(200);
    expect(prefRes.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(prefRes.body)).not.toContain('passwordHash');

    // 7. Export Data Response
    const exportRes = await request(app)
      .post('/api/auth/export-data')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(exportRes.body)).not.toContain('passwordHash');
  });

  // Test 4: Rejects login with incorrect password
  it('4. Rejects invalid password credentials with 401', async () => {
    const email = `test_auth_fail_${Date.now()}@origin-os.internal`;
    await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'CorrectPassword123!', displayName: 'Auth Fail Tester' });

    const failRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword999!' });

    expect(failRes.status).toBe(401);
    expect(failRes.body.success).toBe(false);
    expect(failRes.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  // Test 5: Protected endpoints reject requests with no token (401)
  it('5. Protected endpoints reject requests with no Authorization header', async () => {
    const resTasks = await request(app).get('/api/tasks');
    expect(resTasks.status).toBe(401);
    expect(resTasks.body.error.code).toBe('UNAUTHORIZED');

    const resHabits = await request(app).get('/api/habits');
    expect(resHabits.status).toBe(401);

    const resGoals = await request(app).get('/api/goals');
    expect(resGoals.status).toBe(401);

    const resFinances = await request(app).get('/api/finances/summary');
    expect(resFinances.status).toBe(401);
  });

  // Test 6: Protected endpoints reject requests with invalid/expired token (401)
  it('6. Protected endpoints reject forged or malformed tokens', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', 'Bearer forged_or_invalid_jwt_token_123');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  // Test 7: Cross-tenant data isolation: User A cannot read or mutate User B's resources
  it('7. Enforces strict multi-tenant resource isolation between users', async () => {
    // Create User A
    const userARes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `usera_${Date.now()}@origin-os.internal`, password: 'Password123!', displayName: 'User A' });
    const tokenA = userARes.body.data.token;

    // Create User B
    const userBRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `userb_${Date.now()}@origin-os.internal`, password: 'Password123!', displayName: 'User B' });
    const tokenB = userBRes.body.data.token;

    // User A creates a task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'User A Secret Project', priority: 'high' });
    expect(taskRes.body.success).toBe(true);
    const taskAId = taskRes.body.data.id;

    // User B attempts to access User A's task
    const accessRes = await request(app)
      .get(`/api/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(accessRes.status).toBe(404);

    // User B attempts to mutate User A's task
    const mutateRes = await request(app)
      .patch(`/api/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Tampered by User B' });
    expect(mutateRes.status).toBe(404);

    // User B attempts to delete User A's task
    const deleteRes = await request(app)
      .delete(`/api/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);

    // User B listing tasks does not include User A's task
    const listRes = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`);
    const found = Array.isArray(listRes.body.data) && listRes.body.data.some((t: any) => t.id === taskAId);
    expect(found).toBe(false);
  });

  // Test 8: Server derives identity strictly from authenticated JWT token
  it('8. Server ignores client-supplied userId in body and enforces authenticated JWT identity', async () => {
    const userRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `tamper_${Date.now()}@origin-os.internal`, password: 'Password123!', displayName: 'Tamper Tester' });
    const realUserId = userRes.body.data.user.id;
    const token = userRes.body.data.token;

    // Attempt to create task specifying a fake userId
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Task with spoofed userId', userId: 'usr_fake_victim_999' });

    expect(taskRes.body.success).toBe(true);
    expect(taskRes.body.data.userId).toBe(realUserId); // Must match authenticated token, NOT the body
  });

  // Test 9: AI endpoints require valid authentication
  it('9. AI chat and dynamic insight endpoints reject unauthenticated access with 401', async () => {
    const unauthChat = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Hello Origin' });
    expect(unauthChat.status).toBe(401);

    const unauthInsights = await request(app)
      .post('/api/ai/insights')
      .send({ context: {} });
    expect(unauthInsights.status).toBe(401);

    // With valid auth token, AI endpoints succeed
    const userRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `ai_user_${Date.now()}@origin-os.internal`, password: 'Password123!', displayName: 'AI User' });
    const token = userRes.body.data.token;

    const authChat = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Plan my day' });
    expect(authChat.status).toBe(200);
    expect(authChat.body.success).toBe(true);
  });

  // Test 10: Password reset request endpoint does NOT leak resetToken
  it('10. Password reset request succeeds without exposing the reset token in response', async () => {
    const email = `reset_safe_${Date.now()}@origin-os.internal`;
    await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'OldPassword123!', displayName: 'Reset Safe User' });

    const resetReq = await request(app)
      .post('/api/auth/password-reset-request')
      .send({ email });

    expect(resetReq.status).toBe(200);
    expect(resetReq.body.success).toBe(true);
    expect(resetReq.body.resetToken).toBeUndefined();
    expect(resetReq.body.data?.resetToken).toBeUndefined();
    expect(JSON.stringify(resetReq.body)).not.toContain('rst_');
  });

  // Test 11: Rate limiting returns 429 after exceeding limit
  it('11. Rate limiter enforces request caps and returns HTTP 429 when exceeded', async () => {
    const key = `test_rate_limit_${Date.now()}`;
    // Limit is 5 requests per window
    for (let i = 0; i < 5; i++) {
      const allowed = checkRateLimit(key, 5, 60000);
      expect(allowed).toBe(true);
    }
    // 6th request should fail
    const blocked = checkRateLimit(key, 5, 60000);
    expect(blocked).toBe(false);
  });

  // Test 12: Production secret validation fails fast without falling back to insecure defaults
  it('12. Fails fast in production if JWT_SECRET or ENCRYPTION_SECRET is missing or default', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalJwt = process.env.JWT_SECRET;
    const originalEnc = process.env.ENCRYPTION_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      delete process.env.ENCRYPTION_SECRET;

      expect(() => getJwtSecret()).toThrowError(/CRITICAL_SECURITY_ERROR: JWT_SECRET/);
      expect(() => getEncryptionKey()).toThrowError(/CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET/);

      // Verify that known placeholder values are also rejected in production
      process.env.JWT_SECRET = 'origin-jwt-production-secret-auth-token-2026';
      expect(() => getJwtSecret()).toThrowError(/CRITICAL_SECURITY_ERROR: JWT_SECRET/);

      process.env.ENCRYPTION_SECRET = 'origin-aes-256-gcm-master-key-prod-2026';
      expect(() => getEncryptionKey()).toThrowError(/CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalJwt !== undefined) process.env.JWT_SECRET = originalJwt;
      else delete process.env.JWT_SECRET;
      if (originalEnc !== undefined) process.env.ENCRYPTION_SECRET = originalEnc;
      else delete process.env.ENCRYPTION_SECRET;
    }
  });

  // Test 13: Multi-tenant resource isolation on Habits and Goals (GET, UPDATE, DELETE)
  it('13. Enforces strict isolation on Habits and Goals across GET, UPDATE, DELETE', async () => {
    // User A & User B
    const uARes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `iso_a_${Date.now()}@origin-os.internal`, password: 'Password123!', displayName: 'Iso A' });
    const tokenA = uARes.body.data.token;

    const uBRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `iso_b_${Date.now()}@origin-os.internal`, password: 'Password123!', displayName: 'Iso B' });
    const tokenB = uBRes.body.data.token;

    // User A creates habit
    const habitRes = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Private Habit', frequency: 'daily', timeOfDay: 'morning' });
    expect(habitRes.body.success).toBe(true);
    const habitAId = habitRes.body.data.id;

    // User B attempts to access, mutate, or delete User A's habit
    const getHabit = await request(app).get(`/api/habits/${habitAId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(getHabit.status).toBe(404);

    const updateHabit = await request(app).patch(`/api/habits/${habitAId}`).set('Authorization', `Bearer ${tokenB}`).send({ name: 'Hacked' });
    expect(updateHabit.status).toBe(404);

    const deleteHabit = await request(app).delete(`/api/habits/${habitAId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(deleteHabit.status).toBe(404);

    // User A creates goal
    const goalRes = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Private Goal', category: 'career_craft', timeframe: 'annual' });
    expect(goalRes.body.success).toBe(true);
    const goalAId = goalRes.body.data.id;

    // User B attempts to access, mutate, or delete User A's goal
    const getGoal = await request(app).get(`/api/goals/${goalAId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(getGoal.status).toBe(404);

    const updateGoal = await request(app).patch(`/api/goals/${goalAId}`).set('Authorization', `Bearer ${tokenB}`).send({ title: 'Hacked Goal' });
    expect(updateGoal.status).toBe(404);

    const deleteGoal = await request(app).delete(`/api/goals/${goalAId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(deleteGoal.status).toBe(404);
  });
});
