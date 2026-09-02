import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { apiRouter } from '../routes';
import { db } from '../db';
import { emailService, EmailProvider, EmailMessage } from '../email';
import { verifyPassword, hashResetToken } from '../auth';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

// Mock email provider to capture dispatched emails securely in test harness
class TestEmailCaptureProvider implements EmailProvider {
  readonly name = 'test_capture';
  readonly isRealDelivery = false;
  public sentMessages: EmailMessage[] = [];

  async sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId: string }> {
    this.sentMessages.push(message);
    return { success: true, messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}` };
  }

  clear() {
    this.sentMessages = [];
  }
}

const testEmailProvider = new TestEmailCaptureProvider();

describe('ORIGIN Password Reset Architecture & Security Suite', () => {
  beforeEach(() => {
    testEmailProvider.clear();
    emailService.setProviderForTesting(testEmailProvider);
  });

  // Requirement 1, 3, 11, 12: Cryptographically unpredictable token, never returned in API, user enumeration prevented
  it('1. Forgot-password returns identical generic success message for both existing and non-existing emails, never leaking token', async () => {
    const existingEmail = `existing_${Date.now()}@origin-os.internal`;
    const nonExistingEmail = `nobody_${Date.now()}@origin-os.internal`;

    // Create user
    await request(app)
      .post('/api/auth/signup')
      .send({ email: existingEmail, password: 'SecurePassword123!', displayName: 'Existing User' });

    // 1a. Reset request for existing user
    const resExisting = await request(app)
      .post('/api/auth/password-reset-request')
      .send({ email: existingEmail });

    expect(resExisting.status).toBe(200);
    expect(resExisting.body.success).toBe(true);
    expect(resExisting.body.resetToken).toBeUndefined();
    expect(resExisting.body.data?.resetToken).toBeUndefined();
    expect(JSON.stringify(resExisting.body)).not.toContain('rst_');
    expect(resExisting.body.data.message).toBe(
      'If an account exists with this email address, password reset instructions have been issued.'
    );

    // Email provider received 1 message
    expect(testEmailProvider.sentMessages.length).toBe(1);
    expect(testEmailProvider.sentMessages[0].to).toBe(existingEmail);
    expect(testEmailProvider.sentMessages[0].subject).toContain('Reset your ORIGIN password');
    expect(testEmailProvider.sentMessages[0].html).toContain('/reset-password?token=rst_');

    // 1b. Reset request for non-existing user
    testEmailProvider.clear();
    const resNonExisting = await request(app)
      .post('/api/auth/password-reset-request')
      .send({ email: nonExistingEmail });

    expect(resNonExisting.status).toBe(200);
    expect(resNonExisting.body.success).toBe(true);
    expect(resNonExisting.body.resetToken).toBeUndefined();
    expect(resNonExisting.body.data?.resetToken).toBeUndefined();
    expect(JSON.stringify(resNonExisting.body)).not.toContain('rst_');
    // Same response message prevents email enumeration
    expect(resNonExisting.body.data.message).toBe(resExisting.body.data.message);

    // No email sent for non-existent account
    expect(testEmailProvider.sentMessages.length).toBe(0);
  });

  // Requirement 1, 2, 6, 8, 9, 13: Secure hashed token representation in DB, raw token in email, single-use invalidation
  it('2. Valid token successfully resets password, stores only hash on server, and invalidates single-use token', async () => {
    const email = `reset_flow_${Date.now()}@origin-os.internal`;
    const initialPassword = 'InitialPassword123!';
    const newPassword = 'NewlyChosenPassword456!';

    await request(app)
      .post('/api/auth/signup')
      .send({ email, password: initialPassword, displayName: 'Flow User' });

    // Request reset
    await request(app)
      .post('/api/auth/password-reset-request')
      .send({ email });

    // Extract raw token from securely dispatched email message
    expect(testEmailProvider.sentMessages.length).toBe(1);
    const emailBody = testEmailProvider.sentMessages[0].html;
    const tokenMatch = emailBody.match(/token=(rst_[a-f0-9]{64})/);
    expect(tokenMatch).not.toBeNull();
    const rawValidToken = tokenMatch![1];
    expect(rawValidToken).toMatch(/^rst_[a-f0-9]{64}$/);

    // Server-side DB record stores ONLY the SHA-256 hash of the reset token, NEVER the raw token
    const tokenRecord = db.schema.passwordResetTokens.find((r) => r.email === email && !r.used);
    expect(tokenRecord).toBeDefined();
    expect(tokenRecord!.token).not.toBe(rawValidToken);
    expect(tokenRecord!.token).toBe(hashResetToken(rawValidToken));
    expect(tokenRecord!.token).toMatch(/^[a-f0-9]{64}$/);

    // Confirm password reset with new password using raw token received in email
    const confirmRes = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token: rawValidToken, newPassword });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.message).toContain('successfully updated');

    // Verify token is marked as used in DB immediately (single-use)
    expect(tokenRecord!.used).toBe(true);

    // Verify password is encrypted with bcrypt hash (never plaintext)
    const user = db.schema.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    expect(user).toBeDefined();
    expect(user!.passwordHash).not.toBe(newPassword);
    expect(user!.passwordHash.startsWith('$2')).toBe(true);
    expect(bcrypt.compareSync(newPassword, user!.passwordHash)).toBe(true);
    expect(verifyPassword(newPassword, user!.passwordHash)).toBe(true);

    // Verify user can now log in with the new password
    const loginResNew = await request(app)
      .post('/api/auth/login')
      .send({ email, password: newPassword });
    expect(loginResNew.status).toBe(200);
    expect(loginResNew.body.success).toBe(true);

    // Verify old password no longer works
    const loginResOld = await request(app)
      .post('/api/auth/login')
      .send({ email, password: initialPassword });
    expect(loginResOld.status).toBe(401);
  });

  // Requirement 8: Used token is rejected (single-use enforcement)
  it('3. Rejects already used tokens (single-use enforcement)', async () => {
    const email = `used_token_${Date.now()}@origin-os.internal`;
    await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'Password123!', displayName: 'Used Token User' });

    await request(app)
      .post('/api/auth/password-reset-request')
      .send({ email });

    expect(testEmailProvider.sentMessages.length).toBe(1);
    const tokenMatch = testEmailProvider.sentMessages[0].html.match(/token=(rst_[a-f0-9]{64})/);
    const token = tokenMatch![1];

    // First use: success
    const firstUse = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token, newPassword: 'FirstNewPassword123!' });
    expect(firstUse.status).toBe(200);

    // Second use attempt: rejected with 400
    const secondUse = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token, newPassword: 'SecondNewPassword456!' });
    expect(secondUse.status).toBe(400);
    expect(secondUse.body.error.code).toBe('TOKEN_EXPIRED');
  });

  // Requirement 6 & 7: Strict expiration time and rejection of expired tokens
  it('4. Rejects expired reset tokens', async () => {
    const email = `expired_${Date.now()}@origin-os.internal`;
    await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'Password123!', displayName: 'Expired User' });

    const rawExpiredToken = `rst_expired_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashResetToken(rawExpiredToken);

    db.schema.passwordResetTokens.push({
      token: tokenHash,
      email,
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
      used: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    });
    await db.save();

    const res = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token: rawExpiredToken, newPassword: 'BrandNewPassword123!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  // Requirement 10: Invalid / forged token is rejected without sensitive details
  it('5. Rejects non-existent or forged reset tokens', async () => {
    const res = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token: 'rst_forged_invalid_token_12345', newPassword: 'BrandNewPassword123!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  // Rejects short password (< 6 chars) or missing payload
  it('6. Rejects weak password or malformed payload on confirmation', async () => {
    const resShort = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token: 'rst_any_token', newPassword: '123' });

    expect(resShort.status).toBe(400);
    expect(resShort.body.error.code).toBe('INVALID_PAYLOAD');

    const resEmpty = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({});

    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error.code).toBe('INVALID_PAYLOAD');
  });

  // Requirement 1 & 2: Cryptographic unpredictability and server hashing
  it('7. Generates cryptographically unpredictable reset tokens and hashes them before storage', async () => {
    const email = `crypto_check_${Date.now()}@origin-os.internal`;
    await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'Password123!', displayName: 'Crypto User' });

    await request(app)
      .post('/api/auth/password-reset-request')
      .send({ email });

    expect(testEmailProvider.sentMessages.length).toBe(1);
    const tokenMatch = testEmailProvider.sentMessages[0].html.match(/token=(rst_[a-f0-9]{64})/);
    expect(tokenMatch).not.toBeNull();
    const rawToken = tokenMatch![1];

    // Check high entropy (length of hex portion is 64 hex chars = 32 bytes / 256 bits)
    expect(rawToken.startsWith('rst_')).toBe(true);
    expect(rawToken.slice(4).length).toBe(64);

    const tokenRecord = db.schema.passwordResetTokens.find((r) => r.email === email && !r.used);
    expect(tokenRecord).toBeDefined();
    // Server-side record must NOT equal raw token
    expect(tokenRecord!.token).not.toBe(rawToken);
    // Server-side record must equal SHA-256 hash of the token
    expect(tokenRecord!.token).toBe(hashResetToken(rawToken));
  });
});
