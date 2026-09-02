import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { db } from '../db';
import {
  generateToken,
  generateCryptoToken,
  hashPassword,
  verifyPassword,
  toPublicUser,
  toPublicSubscription,
} from '../auth';
import { userRepository } from '../repositories';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Backend Password Hash Exclusion & Safe Serialization Suite', () => {
  let testUserId: string;
  let testEmail: string;
  const rawPlaintextPassword = 'SecurePassword2026!';
  let storedBcryptHash: string;
  let authToken: string;

  beforeEach(async () => {
    testUserId = generateCryptoToken('usr_test_ph');
    testEmail = `user.ph.${Date.now()}@origin-os.internal`;
    storedBcryptHash = hashPassword(rawPlaintextPassword);

    const testUser = {
      id: testUserId,
      email: testEmail,
      passwordHash: storedBcryptHash,
      role: 'member' as const,
      emailVerified: true,
      profile: {
        displayName: 'Protected User',
        headline: 'Security Focus',
        bio: 'Testing strict hash exclusion boundary',
        primaryLifeFocus: 'Health & Architecture',
      },
      preferences: {
        theme: 'dark' as const,
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1 as const,
        reducedMotion: false,
        compactDensity: true,
        dailyReflectionReminderTime: '21:00',
        notificationChannels: { inApp: true, email: false, dailyDigest: true },
        unlockedModules: ['tasks', 'habits', 'finances', 'goals'],
      },
      subscription: {
        tier: 'pro' as const,
        status: 'active' as const,
        currentPeriodEnd: '2028-01-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await userRepository.create(testUser);
    authToken = generateToken(testUser);
  });

  // 1. Signup response does NOT contain passwordHash
  it('1. Signup response does NOT contain passwordHash, bcrypt hash, or raw password', async () => {
    const signupEmail = `new.signup.${Date.now()}@origin-os.internal`;
    const signupPassword = 'FreshSignupPassword2026!';

    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: signupEmail,
        password: signupPassword,
        displayName: 'Fresh User',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();

    const user = res.body.data.user;
    expect(user.passwordHash).toBeUndefined();
    expect(user.password).toBeUndefined();
    expect(user.password_hash).toBeUndefined();
    expect('passwordHash' in user).toBe(false);
    expect('password' in user).toBe(false);
    expect('password_hash' in user).toBe(false);

    // Verify entire serialized JSON response does not contain passwordHash or plaintext password
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('passwordHash');
    expect(jsonStr).not.toContain('password_hash');
    expect(jsonStr).not.toContain(signupPassword);
  });

  // 2. Login response does NOT contain passwordHash
  it('2. Login response does NOT contain passwordHash, bcrypt hash, or raw password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: rawPlaintextPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();

    const user = res.body.data.user;
    expect(user.passwordHash).toBeUndefined();
    expect(user.password).toBeUndefined();
    expect(user.password_hash).toBeUndefined();
    expect('passwordHash' in user).toBe(false);
    expect('password' in user).toBe(false);

    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('passwordHash');
    expect(jsonStr).not.toContain(storedBcryptHash);
    expect(jsonStr).not.toContain(rawPlaintextPassword);
  });

  // 3. Current-session/user response does NOT contain passwordHash
  it('3. Current-session and user endpoints do NOT contain passwordHash', async () => {
    // 3a. /api/auth/session
    const sessionRes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${authToken}`);

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.data.user).toBeDefined();
    expect(sessionRes.body.data.user.passwordHash).toBeUndefined();
    expect('passwordHash' in sessionRes.body.data.user).toBe(false);
    expect(JSON.stringify(sessionRes.body)).not.toContain('passwordHash');
    expect(JSON.stringify(sessionRes.body)).not.toContain(storedBcryptHash);

    // 3b. /api/users/profile
    const profileRes = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${authToken}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.passwordHash).toBeUndefined();
    expect('passwordHash' in profileRes.body.data).toBe(false);
    expect(JSON.stringify(profileRes.body)).not.toContain('passwordHash');

    // 3c. /api/users/me
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.passwordHash).toBeUndefined();
    expect('passwordHash' in meRes.body.data).toBe(false);
    expect(JSON.stringify(meRes.body)).not.toContain('passwordHash');

    // 3d. /api/users/preferences
    const prefRes = await request(app)
      .get('/api/users/preferences')
      .set('Authorization', `Bearer ${authToken}`);

    expect(prefRes.status).toBe(200);
    expect(prefRes.body.data.passwordHash).toBeUndefined();
    expect('passwordHash' in prefRes.body.data).toBe(false);
    expect(JSON.stringify(prefRes.body)).not.toContain('passwordHash');
  });

  // 4. No alternative field contains the password hash
  it('4. No alternative field contains the password hash or secret credential', async () => {
    const sessionRes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${authToken}`);

    const user = sessionRes.body.data.user;
    const suspiciousKeys = [
      'passwordHash',
      'password_hash',
      'passHash',
      'pwdHash',
      'password',
      'pwd',
      'pass',
      'hash',
      'secret',
      'credentials',
      'credential',
      'token_hash',
      'authHash',
    ];

    suspiciousKeys.forEach((key) => {
      expect((user as any)[key]).toBeUndefined();
    });

    // Check all values in user object recursively to ensure stored bcrypt hash is never present
    const allValues = JSON.stringify(user);
    expect(allValues).not.toContain(storedBcryptHash);
    expect(allValues).not.toContain('$2a$');
    expect(allValues).not.toContain('$2b$');
    expect(allValues).not.toContain('$2y$');
  });

  // 5. The authenticated user still receives all legitimate non-sensitive user fields
  it('5. The authenticated user still receives all legitimate non-sensitive user fields', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const user = res.body.data.user;

    expect(user.id).toBe(testUserId);
    expect(user.email).toBe(testEmail);
    expect(user.role).toBe('member');
    expect(user.emailVerified).toBe(true);
    expect(user.profile.displayName).toBe('Protected User');
    expect(user.profile.headline).toBe('Security Focus');
    expect(user.profile.bio).toBe('Testing strict hash exclusion boundary');
    expect(user.profile.primaryLifeFocus).toBe('Health & Architecture');
    expect(user.preferences.theme).toBe('dark');
    expect(user.preferences.timezone).toBe('UTC');
    expect(user.preferences.locale).toBe('en-US');
    expect(user.preferences.weekStartDay).toBe(1);
    expect(user.preferences.compactDensity).toBe(true);
    expect(user.subscription.tier).toBe('pro');
    expect(user.subscription.status).toBe('active');
    expect(typeof user.createdAt).toBe('string');
    expect(typeof user.updatedAt).toBe('string');
  });

  // 6. Authentication continues to work normally
  it('6. Authentication continues to work normally', async () => {
    // Correct password succeeds
    const successLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: rawPlaintextPassword,
      });

    expect(successLogin.status).toBe(200);
    expect(successLogin.body.data.token).toBeDefined();

    // Invalid password fails
    const failedLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword123!',
      });

    expect(failedLogin.status).toBe(401);
    expect(failedLogin.body.success).toBe(false);
    expect(failedLogin.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  // 7. Database retains the password hash where required for auth, but it is never serialized in API responses
  it('7. Database retains password hash for auth checks, but API responses exclude it', async () => {
    // Database record contains the bcrypt hash
    const userInDb = await userRepository.findById(testUserId);
    expect(userInDb).not.toBeNull();
    expect(userInDb?.passwordHash).toBeDefined();
    expect(userInDb?.passwordHash).toBe(storedBcryptHash);
    expect(verifyPassword(rawPlaintextPassword, userInDb!.passwordHash)).toBe(true);

    // When serialized via toPublicUser or via endpoint, hash is excluded
    const publicUser = toPublicUser(userInDb!);
    expect((publicUser as any).passwordHash).toBeUndefined();
    expect('passwordHash' in publicUser).toBe(false);
  });

  // 8. Search all backend API responses that return user objects and verify passwordHash cannot leak
  it('8. Profile update and preferences update endpoints never return passwordHash', async () => {
    // 8a. PUT /api/users/profile
    const updateProfileRes = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        displayName: 'Updated Name',
        headline: 'New Headline',
      });

    expect(updateProfileRes.status).toBe(200);
    expect(updateProfileRes.body.data.displayName || updateProfileRes.body.data.profile?.displayName).toBeDefined();
    expect(updateProfileRes.body.data.passwordHash).toBeUndefined();
    expect('passwordHash' in updateProfileRes.body.data).toBe(false);
    expect(JSON.stringify(updateProfileRes.body)).not.toContain('passwordHash');
    expect(JSON.stringify(updateProfileRes.body)).not.toContain(storedBcryptHash);

    // 8b. PUT /api/users/preferences
    const updatePrefRes = await request(app)
      .put('/api/users/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        theme: 'light',
        compactDensity: false,
      });

    expect(updatePrefRes.status).toBe(200);
    expect(updatePrefRes.body.data.passwordHash).toBeUndefined();
    expect('passwordHash' in updatePrefRes.body.data).toBe(false);
    expect(JSON.stringify(updatePrefRes.body)).not.toContain('passwordHash');
    expect(JSON.stringify(updatePrefRes.body)).not.toContain(storedBcryptHash);
  });
});
