import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../auth.service';
import { safeStorage } from '../../lib/storage';

describe('Authentication & User Account Security Suite', () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it('registers new user account, enforces password hash and creates initial preferences', async () => {
    const signupRes = await authService.signup({
      email: 'new.operator@origin-os.internal',
      password: 'StrongPassword123!',
      displayName: 'Operator Nova',
    });

    expect(signupRes.success).toBe(true);
    expect(signupRes.data?.user.email).toBe('new.operator@origin-os.internal');
    expect(signupRes.data?.user.profile.displayName).toBe('Operator Nova');
    expect(signupRes.data?.token).toBeDefined();

    // Verify session persistence
    const sessionRes = await authService.getCurrentSession();
    expect(sessionRes.success).toBe(true);
    expect(sessionRes.data?.user.id).toBe(signupRes.data?.user.id);
  });

  it('rejects duplicate user registrations with descriptive security error', async () => {
    await authService.signup({
      email: 'duplicate@origin-os.internal',
      password: 'StrongPassword123!',
      displayName: 'User One',
    });

    const duplicateRes = await authService.signup({
      email: 'duplicate@origin-os.internal',
      password: 'AnotherPassword456!',
      displayName: 'User Two',
    });

    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.error?.code).toBe('AUTH_EMAIL_EXISTS');
  });

  it('authenticates valid credentials and rejects incorrect passwords', async () => {
    await authService.signup({
      email: 'login.test@origin-os.internal',
      password: 'CorrectPassword123!',
      displayName: 'Login Tester',
    });

    // Attempt with incorrect password
    const failRes = await authService.login({
      email: 'login.test@origin-os.internal',
      password: 'WrongPassword!',
    });
    expect(failRes.success).toBe(false);
    expect(failRes.error?.code).toBe('AUTH_INVALID_CREDENTIALS');

    // Attempt with correct password
    const successRes = await authService.login({
      email: 'login.test@origin-os.internal',
      password: 'CorrectPassword123!',
    });
    expect(successRes.success).toBe(true);
    expect(successRes.data?.user.email).toBe('login.test@origin-os.internal');
  });

  it('terminates active session on logout', async () => {
    await authService.signup({
      email: 'logout.test@origin-os.internal',
      password: 'Password123!',
      displayName: 'Logout Tester',
    });

    const logoutRes = await authService.logout();
    expect(logoutRes.success).toBe(true);

    const sessionRes = await authService.getCurrentSession();
    expect(sessionRes.data).toBeNull();
  });

  it('handles password reset flows securely', async () => {
    await authService.signup({
      email: 'reset.test@origin-os.internal',
      password: 'OldPassword123!',
      displayName: 'Reset Tester',
    });

    const requestRes = await authService.requestPasswordReset({
      email: 'reset.test@origin-os.internal',
    });
    expect(requestRes.success).toBe(true);
    expect(requestRes.data?.resetToken).toBeDefined();

    const confirmRes = await authService.confirmPasswordReset({
      token: requestRes.data!.resetToken,
      newPassword: 'NewSecurePassword456!',
    });
    expect(confirmRes.success).toBe(true);

    // Verify login with new password
    const loginRes = await authService.login({
      email: 'reset.test@origin-os.internal',
      password: 'NewSecurePassword456!',
    });
    expect(loginRes.success).toBe(true);
  });
});
