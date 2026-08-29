import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { db } from '../db';
import { generateToken, generateCryptoToken, hashPassword, toPublicUser, toPublicSubscription } from '../auth';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Safe Response Serialization - Preventing Internal User Field Exposure', () => {
  let authToken: string;
  let testUserId: string;
  let testEmail: string;

  beforeEach(() => {
    testUserId = generateCryptoToken('usr_leak_test');
    testEmail = `leak.test.${Date.now()}@origin-os.internal`;

    const testUser = {
      id: testUserId,
      email: testEmail,
      passwordHash: hashPassword('SecretPass999!'),
      verificationToken: 'vtok_secret_internal_value_123',
      role: 'member' as const,
      emailVerified: true,
      profile: {
        displayName: 'Exposure Guard Tester',
        headline: 'Security Architect',
        bio: 'Verifying zero internal field leaks',
        primaryLifeFocus: 'Intentional Living',
      },
      preferences: {
        theme: 'dark' as const,
        timezone: 'America/New_York',
        locale: 'en-US',
        weekStartDay: 1 as const,
        reducedMotion: false,
        compactDensity: true,
        dailyReflectionReminderTime: '22:00',
        notificationChannels: { inApp: true, email: false, dailyDigest: true },
        unlockedModules: ['tasks', 'habits', 'finances', 'goals'],
      },
      subscription: {
        tier: 'pro' as const,
        status: 'active' as const,
        currentPeriodEnd: '2027-01-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
        stripeCustomerId: 'cus_secret_12345_internal',
        stripeSubscriptionId: 'sub_secret_67890_internal',
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.users.push(testUser);
    authToken = generateToken(testUser);
  });

  it('1. Signup response never contains passwordHash or internal security tokens', async () => {
    const email = `new.signup.${Date.now()}@origin-os.internal`;
    const password = 'UltraSecurePassword123!';

    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email,
        password,
        displayName: 'Fresh User',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();

    const user = res.body.data.user;
    expect(user.passwordHash).toBeUndefined();
    expect(user.password).toBeUndefined();
    expect(user.verificationToken).toBeUndefined();
    expect(user.resetPasswordToken).toBeUndefined();

    // Verify raw JSON string does not contain sensitive internal field names
    const jsonString = JSON.stringify(res.body);
    expect(jsonString).not.toContain('passwordHash');
    expect(jsonString).not.toContain('verificationToken');
    expect(jsonString).not.toContain('resetPasswordToken');
    expect(jsonString).not.toContain(password);
  });

  it('2. Login response never contains passwordHash or internal security tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'SecretPass999!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();

    const user = res.body.data.user;
    expect(user.passwordHash).toBeUndefined();
    expect(user.password).toBeUndefined();
    expect(user.verificationToken).toBeUndefined();
    expect(user.resetPasswordToken).toBeUndefined();

    const jsonString = JSON.stringify(res.body);
    expect(jsonString).not.toContain('passwordHash');
    expect(jsonString).not.toContain('verificationToken');
    expect(jsonString).not.toContain('vtok_secret_internal_value_123');
  });

  it('3. Session response never contains passwordHash or internal security tokens', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();

    const user = res.body.data.user;
    expect(user.passwordHash).toBeUndefined();
    expect(user.verificationToken).toBeUndefined();
    expect(user.subscription?.stripeCustomerId).toBeUndefined();
    expect(user.subscription?.stripeSubscriptionId).toBeUndefined();

    const jsonString = JSON.stringify(res.body);
    expect(jsonString).not.toContain('passwordHash');
    expect(jsonString).not.toContain('verificationToken');
    expect(jsonString).not.toContain('cus_secret_12345_internal');
    expect(jsonString).not.toContain('sub_secret_67890_internal');
  });

  it('4. User/profile/preferences/me responses never contain passwordHash or internal fields', async () => {
    // 4a. GET /users/profile
    const profileGetRes = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${authToken}`);

    expect(profileGetRes.status).toBe(200);
    expect(profileGetRes.body.data.passwordHash).toBeUndefined();
    expect(profileGetRes.body.data.verificationToken).toBeUndefined();
    expect(JSON.stringify(profileGetRes.body)).not.toContain('passwordHash');

    // 4b. PUT /users/profile
    const profilePutRes = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ headline: 'Updated Headline' });

    expect(profilePutRes.status).toBe(200);
    expect(profilePutRes.body.data.passwordHash).toBeUndefined();
    expect(profilePutRes.body.data.verificationToken).toBeUndefined();
    expect(JSON.stringify(profilePutRes.body)).not.toContain('passwordHash');

    // 4c. GET /users/preferences
    const prefGetRes = await request(app)
      .get('/api/users/preferences')
      .set('Authorization', `Bearer ${authToken}`);

    expect(prefGetRes.status).toBe(200);
    expect(prefGetRes.body.data.passwordHash).toBeUndefined();
    expect(prefGetRes.body.data.verificationToken).toBeUndefined();
    expect(JSON.stringify(prefGetRes.body)).not.toContain('passwordHash');

    // 4d. PUT /users/preferences
    const prefPutRes = await request(app)
      .put('/api/users/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ theme: 'light' });

    expect(prefPutRes.status).toBe(200);
    expect(prefPutRes.body.data.passwordHash).toBeUndefined();
    expect(prefPutRes.body.data.verificationToken).toBeUndefined();
    expect(JSON.stringify(prefPutRes.body)).not.toContain('passwordHash');

    // 4e. GET /users/me
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.passwordHash).toBeUndefined();
    expect(meRes.body.data.verificationToken).toBeUndefined();
    expect(JSON.stringify(meRes.body)).not.toContain('passwordHash');
  });

  it('5. Reset tokens and internal reset credentials are never exposed through API responses', async () => {
    // 5a. Request reset
    const reqRes = await request(app)
      .post('/api/auth/password-reset-request')
      .send({ email: testEmail });

    expect(reqRes.status).toBe(200);
    expect(reqRes.body.data.token).toBeUndefined();
    expect(reqRes.body.data.resetToken).toBeUndefined();
    expect(reqRes.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(reqRes.body)).not.toContain('token');

    // 5b. Check db token collection has reset token
    const tokenRecord = db.schema.passwordResetTokens.find((r) => r.email.toLowerCase() === testEmail.toLowerCase() && !r.used);
    expect(tokenRecord).toBeDefined();
    const tokenValue = tokenRecord!.token;

    // 5c. Confirm reset
    const confirmRes = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({
        token: tokenValue,
        newPassword: 'BrandNewSecurePassword456!',
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.token).toBeUndefined();
    expect(confirmRes.body.data.resetPasswordToken).toBeUndefined();
    expect(confirmRes.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(confirmRes.body)).not.toContain('passwordHash');
    expect(JSON.stringify(confirmRes.body)).not.toContain('BrandNewSecurePassword456!');
  });

  it('6. Billing and subscription responses do not expose internal customer or subscription IDs', async () => {
    const billingRes = await request(app)
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${authToken}`);

    expect(billingRes.status).toBe(200);
    expect(billingRes.body.success).toBe(true);
    expect(billingRes.body.data.subscription).toBeDefined();
    expect(billingRes.body.data.subscription.tier).toBe('pro');
    expect(billingRes.body.data.subscription.status).toBe('active');

    // Ensure internal stripe keys are not present
    expect(billingRes.body.data.subscription.stripeCustomerId).toBeUndefined();
    expect(billingRes.body.data.subscription.stripeSubscriptionId).toBeUndefined();
    expect(JSON.stringify(billingRes.body)).not.toContain('cus_secret_12345_internal');
    expect(JSON.stringify(billingRes.body)).not.toContain('sub_secret_67890_internal');
  });

  it('7. Legitimate public user fields are preserved and accurately returned', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const user = res.body.data.user;

    expect(user.id).toBe(testUserId);
    expect(user.email).toBe(testEmail);
    expect(user.role).toBe('member');
    expect(user.emailVerified).toBe(true);
    expect(user.profile.displayName).toBe('Exposure Guard Tester');
    expect(user.profile.headline).toBe('Security Architect');
    expect(user.profile.bio).toBe('Verifying zero internal field leaks');
    expect(user.profile.primaryLifeFocus).toBe('Intentional Living');
    expect(user.preferences.theme).toBe('dark');
    expect(user.preferences.timezone).toBe('America/New_York');
    expect(user.preferences.locale).toBe('en-US');
    expect(user.preferences.weekStartDay).toBe(1);
    expect(user.preferences.compactDensity).toBe(true);
    expect(user.subscription.tier).toBe('pro');
    expect(user.subscription.status).toBe('active');
    expect(user.subscription.currentPeriodEnd).toBe('2027-01-01T00:00:00.000Z');
    expect(typeof user.createdAt).toBe('string');
    expect(typeof user.updatedAt).toBe('string');
  });

  it('8. Unit test: toPublicUser strictly whitelists fields and rejects arbitrary private attachments', () => {
    const dirtyUserObject: any = {
      id: 'usr_unit_123',
      email: 'dirty@origin-os.internal',
      role: 'admin',
      emailVerified: true,
      passwordHash: '$2b$10$supersecretinternalhashvalue',
      verificationToken: 'vtok_unit_123',
      resetPasswordToken: 'rtok_unit_123',
      resetPasswordExpires: '2026-12-31',
      internalFlag: true,
      encryptionSecret: 'enc_secret_key_123',
      serverMetadata: { ip: '127.0.0.1' },
      profile: {
        displayName: 'Unit Tester',
        headline: 'Lead',
        privateNote: 'Should not copy',
      },
      preferences: {
        theme: 'light',
        timezone: 'UTC',
      },
      subscription: {
        tier: 'pro',
        status: 'active',
        stripeCustomerId: 'cus_unit_123',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const clean = toPublicUser(dirtyUserObject);

    expect((clean as any).passwordHash).toBeUndefined();
    expect((clean as any).verificationToken).toBeUndefined();
    expect((clean as any).resetPasswordToken).toBeUndefined();
    expect((clean as any).resetPasswordExpires).toBeUndefined();
    expect((clean as any).internalFlag).toBeUndefined();
    expect((clean as any).encryptionSecret).toBeUndefined();
    expect((clean as any).serverMetadata).toBeUndefined();
    expect((clean.profile as any).privateNote).toBeUndefined();
    expect((clean.subscription as any)?.stripeCustomerId).toBeUndefined();

    expect(clean.id).toBe('usr_unit_123');
    expect(clean.email).toBe('dirty@origin-os.internal');
    expect(clean.role).toBe('admin');
    expect(clean.profile.displayName).toBe('Unit Tester');
  });
});
