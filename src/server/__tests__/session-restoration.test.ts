import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { apiRouter, resetRateLimitsForTesting } from '../routes';
import { getJwtSecret, inspectToken, requireAuth, AuthenticatedRequest } from '../auth';
import { authService } from '../../services/auth.service';
import { safeStorage } from '../../lib/storage';
import { APP_CONSTANTS } from '../../config/constants';
import { apiClient } from '../../lib/api-client';
import { db } from '../db';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

// Add a test-protected endpoint to verify authorization enforcement
app.get('/api/test/protected', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    message: 'Authorized access granted',
    userId: req.userId,
    userEmail: req.user?.email,
  });
});

describe('Secure Session Restoration & Cached Authentication Authority Test Suite (Task 2)', () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
    safeStorage.clear();
    vi.restoreAllMocks();
  });

  // TEST 1: Valid backend session → authenticated.
  it('TEST 1: Valid backend session → authenticated', async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `valid_session_${Date.now()}@origin-os.internal`,
        password: 'ValidPassword123!',
        displayName: 'Valid User',
      });
    expect(signupRes.status).toBe(200);
    const session = signupRes.body.data;

    // Simulate stored session in client storage
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, session);
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, session.token);

    // Mock apiClient.get to call server endpoint
    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${session.token}`);
      return {
        success: res.status === 200,
        data: res.body.data,
        error: res.body.error,
      };
    });

    const result = await authService.restoreSession();
    expect(result.status).toBe('AUTHENTICATED');
    expect(result.session).not.toBeNull();
    expect(result.session?.user.email).toBe(session.user.email);
    expect(result.session?.token).toBe(session.token);
  });

  // TEST 2: Expired token → unauthenticated.
  it('TEST 2: Expired token → unauthenticated', async () => {
    const secret = getJwtSecret();
    const expiredToken = jwt.sign(
      { userId: 'usr_expired_123', email: 'expired@origin-os.internal', role: 'user' },
      secret,
      { expiresIn: '-10s' } // Expired 10 seconds ago
    );

    const expiredSession = {
      user: { id: 'usr_expired_123', email: 'expired@origin-os.internal', role: 'user' },
      token: expiredToken,
      expiresAt: new Date(Date.now() - 10000).toISOString(),
    };

    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, expiredSession);
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, expiredToken);

    // Direct server verification returns 401 with TOKEN_EXPIRED
    const serverRes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(serverRes.status).toBe(401);
    expect(serverRes.body.error.code).toBe('TOKEN_EXPIRED');

    // Test client-side service restoreSession
    const result = await authService.restoreSession();
    expect(result.status).toBe('TOKEN_EXPIRED');
    expect(result.session).toBeNull();

    // Stored tokens must be cleared
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null)).toBeNull();
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBeNull();
  });

  // TEST 3: Invalid token → authentication rejected.
  it('TEST 3: Invalid token → authentication rejected', async () => {
    const forgedToken = jwt.sign(
      { userId: 'usr_hacker_999', email: 'hacker@origin-os.internal', role: 'user' },
      'wrong_secret_key_1234567890'
    );

    const forgedSession = {
      user: { id: 'usr_hacker_999', email: 'hacker@origin-os.internal', role: 'user' },
      token: forgedToken,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, forgedSession);
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, forgedToken);

    // Server verification returns 401 with TOKEN_INVALID
    const serverRes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(serverRes.status).toBe(401);
    expect(['TOKEN_INVALID', 'INVALID_TOKEN']).toContain(serverRes.body.error.code);

    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${forgedToken}`);
      return {
        success: res.status === 200,
        data: res.body.data,
        error: res.body.error,
      };
    });

    const result = await authService.restoreSession();
    expect(result.status).toBe('TOKEN_INVALID');
    expect(result.session).toBeNull();

    // Storage must be purged of forged token
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null)).toBeNull();
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBeNull();
  });

  // TEST 4: Backend unavailable → NETWORK_ERROR, not fake authentication.
  it('TEST 4: Backend unavailable → NETWORK_ERROR, not fake authentication', async () => {
    const validLookingSession = {
      user: { id: 'usr_offline_123', email: 'offline@origin-os.internal', role: 'user' },
      token: 'some_unverified_token_string',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, validLookingSession);
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, validLookingSession.token);

    // Simulate network failure reaching backend
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Failed to fetch: Connection refused' },
    });

    const result = await authService.restoreSession();

    // MUST return NETWORK_ERROR status and NOT authenticate the user
    expect(result.status).toBe('NETWORK_ERROR');
    expect(result.session).toBeNull();

    // getCurrentSession must also fail and not claim success
    const currentSessionRes = await authService.getCurrentSession();
    expect(currentSessionRes.success).toBe(false);
    expect(currentSessionRes.data).toBeNull();
    expect(currentSessionRes.error?.code).toBe('NETWORK_ERROR');
  });

  // TEST 5: Cached session cannot bypass backend authentication.
  it('TEST 5: Cached session cannot bypass backend authentication', async () => {
    // Injecting arbitrary admin session directly into client cache
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, {
      user: { id: 'usr_admin_spoof', email: 'admin@origin-os.internal', role: 'admin' },
      token: 'tampered.jwt.token',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, 'tampered.jwt.token');

    // Server verification fails on backend
    const serverRes = await request(app)
      .get('/api/test/protected')
      .set('Authorization', 'Bearer tampered.jwt.token');
    expect(serverRes.status).toBe(401);

    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer tampered.jwt.token');
      return {
        success: res.status === 200,
        data: res.body.data,
        error: res.body.error,
      };
    });

    const result = await authService.restoreSession();
    expect(result.status).toBe('TOKEN_INVALID');
    expect(result.session).toBeNull();
  });

  // TEST 6: Logout clears authentication state.
  it('TEST 6: Logout clears authentication state', async () => {
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, { token: 'mock_active_token' });
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, 'mock_active_token');

    const logoutRes = await authService.logout();
    expect(logoutRes.success).toBe(true);

    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null)).toBeNull();
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBeNull();
  });

  // TEST 7: After logout + page refresh, the previous session is not restored.
  it('TEST 7: After logout + page refresh, the previous session is not restored', async () => {
    // 1. Initial valid login
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `logout_test_${Date.now()}@origin-os.internal`,
        password: 'Password123!',
        displayName: 'Logout User',
      });
    const session = signupRes.body.data;
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, session);
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, session.token);

    // 2. Perform logout
    await authService.logout();

    // 3. Emulate page refresh / cold start (restoring from storage)
    const refreshedRestore = await authService.restoreSession();
    expect(refreshedRestore.status).toBe('UNAUTHENTICATED');
    expect(refreshedRestore.session).toBeNull();

    const refreshedCurrent = await authService.getCurrentSession();
    expect(refreshedCurrent.success).toBe(false);
    expect(refreshedCurrent.data).toBeNull();
    expect(refreshedCurrent.error?.code).toBe('UNAUTHENTICATED');
  });

  // TEST 8: Client-supplied userId cannot change the authenticated identity.
  it('TEST 8: Client-supplied userId cannot change the authenticated identity', async () => {
    // Create Alice and Bob
    const aliceRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `alice_${Date.now()}@origin-os.internal`,
        password: 'Password123!',
        displayName: 'Alice',
      });
    const bobRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `bob_${Date.now()}@origin-os.internal`,
        password: 'Password123!',
        displayName: 'Bob',
      });

    const aliceToken = aliceRes.body.data.token;
    const bobUserId = bobRes.body.data.user.id;

    // Alice requests protected route attempting to pass Bob's userId in query and body
    const testRes = await request(app)
      .get(`/api/test/protected?userId=${bobUserId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: bobUserId });

    expect(testRes.status).toBe(200);
    // Identity MUST be Alice, derived strictly from token signature
    expect(testRes.body.userId).toBe(aliceRes.body.data.user.id);
    expect(testRes.body.userId).not.toBe(bobUserId);
    expect(testRes.body.userEmail).toBe(aliceRes.body.data.user.email);
  });

  // TEST 9: No mock JWT or fake authentication token is generated.
  it('TEST 9: No mock JWT or fake authentication token is generated on client error or fallback', async () => {
    // Ensure that failed login, missing session, or offline state never produces a fake token string
    const failedLogin = await authService.login({
      email: 'nonexistent@origin-os.internal',
      password: 'WrongPassword',
    });
    expect(failedLogin.success).toBe(false);
    expect(failedLogin.data).toBeUndefined();
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBeNull();

    // Verify token inspecting utility requires real signature and real structure
    const inspectResult = inspectToken('fake.header.signature');
    expect(inspectResult.valid).toBe(false);
    expect(inspectResult.payload).toBeNull();
  });

  // TEST 10: Temporary network failure does not create an unauthorized access path.
  it('TEST 10: Temporary network failure does not create an unauthorized access path', async () => {
    // User has an unverified session in storage
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, {
      user: { id: 'usr_unverified', email: 'unverified@origin.io', role: 'admin' },
      token: 'unverified_token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, 'unverified_token');

    // Simulate temporary network failure
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Network offline' },
    });

    const restoreResult = await authService.restoreSession();
    expect(restoreResult.status).toBe('NETWORK_ERROR');
    expect(restoreResult.session).toBeNull();

    // Verify that protected API request to server directly fails with 401
    const protectedReq = await request(app)
      .get('/api/test/protected')
      .set('Authorization', 'Bearer unverified_token');
    expect(protectedReq.status).toBe(401);
  });
});
