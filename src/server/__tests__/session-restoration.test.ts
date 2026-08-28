import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { apiRouter, resetRateLimitsForTesting } from '../routes';
import { getJwtSecret, inspectToken } from '../auth';
import { authService } from '../../services/auth.service';
import { safeStorage } from '../../lib/storage';
import { APP_CONSTANTS } from '../../config/constants';
import { apiClient } from '../../lib/api-client';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Secure Session Restoration & Cached Authentication Authority Test Suite', () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
    safeStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. Backend remains final authority: Valid token succeeds and restores session', async () => {
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
  });

  it('2. Expired token is rejected by backend with TOKEN_EXPIRED and removes stored credentials', async () => {
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

  it('3. Invalid/tampered token is rejected with TOKEN_INVALID and removes stored credentials', async () => {
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

  it('4. Backend unavailable (NETWORK_ERROR) does NOT create fake authentication', async () => {
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

  it('5. Cached session bypass prevention: Storage presence alone does not grant access', async () => {
    // Attempting to bypass backend by directly injecting an arbitrary user into localStorage
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, {
      user: { id: 'usr_admin_spoof', email: 'admin@origin-os.internal', role: 'admin' },
      token: 'fake_jwt_payload_header.signature',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    // Mock apiClient to query server
    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer fake_jwt_payload_header.signature');
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

  it('6. Logout clears all stored state cleanly', async () => {
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, { token: 'mock' });
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, 'mock');

    const logoutRes = await authService.logout();
    expect(logoutRes.success).toBe(true);

    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null)).toBeNull();
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBeNull();

    const check = await authService.restoreSession();
    expect(check.status).toBe('UNAUTHENTICATED');
    expect(check.session).toBeNull();
  });

  it('7. inspectToken accurately differentiates valid, expired, and invalid signatures', () => {
    const secret = getJwtSecret();
    const valid = jwt.sign({ userId: 'u1', email: 'u1@origin.io', role: 'user' }, secret, { expiresIn: '1h' });
    const expired = jwt.sign({ userId: 'u2', email: 'u2@origin.io', role: 'user' }, secret, { expiresIn: '-1m' });
    const forged = jwt.sign({ userId: 'u3', email: 'u3@origin.io', role: 'user' }, 'other_secret');

    const resValid = inspectToken(valid);
    expect(resValid.valid).toBe(true);
    expect(resValid.expired).toBe(false);
    expect(resValid.payload?.userId).toBe('u1');

    const resExpired = inspectToken(expired);
    expect(resExpired.valid).toBe(false);
    expect(resExpired.expired).toBe(true);
    expect(resExpired.payload).toBeNull();

    const resForged = inspectToken(forged);
    expect(resForged.valid).toBe(false);
    expect(resForged.expired).toBe(false);
    expect(resForged.payload).toBeNull();
  });
});
