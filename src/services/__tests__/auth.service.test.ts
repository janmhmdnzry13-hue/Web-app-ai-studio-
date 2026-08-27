import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../auth.service';
import { safeStorage } from '../../lib/storage';
import { apiClient } from '../../lib/api-client';
import { APP_CONSTANTS } from '../../config/constants';

describe('AuthService Client State and Storage Suite', () => {
  beforeEach(() => {
    safeStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores token and session on successful signup', async () => {
    const mockSession = {
      token: 'jwt.valid.token123',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      user: {
        id: 'usr_new_1',
        email: 'operator@origin-os.internal',
        role: 'member' as const,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        profile: { displayName: 'Operator Nova' },
        preferences: {
          theme: 'system' as const,
          timezone: 'UTC',
          locale: 'en-US',
          weekStartDay: 1 as const,
          reducedMotion: false,
          compactDensity: false,
          dailyReflectionReminderTime: null,
          notificationChannels: { inApp: true, email: false, dailyDigest: false },
        },
      },
    };

    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: mockSession,
    });

    const signupRes = await authService.signup({
      email: 'operator@origin-os.internal',
      password: 'StrongPassword123!',
      displayName: 'Operator Nova',
    });

    expect(signupRes.success).toBe(true);
    expect(signupRes.data?.user.email).toBe('operator@origin-os.internal');
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBe('jwt.valid.token123');
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null)).toEqual(mockSession);
  });

  it('rejects signup if validation fails on client or server', async () => {
    const emptyEmail = await authService.signup({ email: '', password: '123', displayName: 'A' });
    expect(emptyEmail.success).toBe(false);
    expect(emptyEmail.error?.code).toBe('AUTH_INVALID_EMAIL');

    const shortPassword = await authService.signup({ email: 'test@example.com', password: '123', displayName: 'Valid' });
    expect(shortPassword.success).toBe(false);
    expect(shortPassword.error?.code).toBe('AUTH_WEAK_PASSWORD');
  });

  it('authenticates valid credentials and caches session on login', async () => {
    const mockSession = {
      token: 'jwt.login.token456',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      user: {
        id: 'usr_login_1',
        email: 'login.test@origin-os.internal',
        role: 'member' as const,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        profile: { displayName: 'Login Tester' },
        preferences: {
          theme: 'dark' as const,
          timezone: 'UTC',
          locale: 'en-US',
          weekStartDay: 1 as const,
          reducedMotion: false,
          compactDensity: false,
          dailyReflectionReminderTime: null,
          notificationChannels: { inApp: true, email: false, dailyDigest: false },
        },
      },
    };

    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: mockSession,
    });

    const loginRes = await authService.login({
      email: 'login.test@origin-os.internal',
      password: 'CorrectPassword123!',
    });

    expect(loginRes.success).toBe(true);
    expect(loginRes.data?.token).toBe('jwt.login.token456');
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBe('jwt.login.token456');
  });

  it('terminates active session on logout and clears tokens from storage', async () => {
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, 'active_token');
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, { token: 'active_token', expiresAt: '2099-01-01' });

    const logoutRes = await authService.logout();
    expect(logoutRes.success).toBe(true);

    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBeNull();
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null)).toBeNull();
  });

  it('automatically invalidates expired sessions in getCurrentSession', async () => {
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, 'expired_token');
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, {
      token: 'expired_token',
      expiresAt: new Date(Date.now() - 10000).toISOString(),
      user: { id: 'usr_old' },
    });

    const sessionRes = await authService.getCurrentSession();
    expect(sessionRes.data).toBeNull();
    expect(safeStorage.get(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null)).toBeNull();
  });
});
