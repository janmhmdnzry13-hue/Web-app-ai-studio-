import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { apiRouter } from '../routes';
import { db } from '../db';
import { emailService, EmailProvider, EmailMessage } from '../email';
import { verifyPassword } from '../auth';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

// Mock email provider to capture dispatched emails securely in test harness
class TestEmailCaptureProvider implements EmailProvider {
  readonly name = 'test_capture';
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

  // Requirement 1 & 8: API never returns resetToken, and does not leak whether email exists
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

  // Requirement 6 & 10: Valid token successfully resets password, hashes password, and immediately invalidates token (single-use)
  it('2. Valid token successfully resets password, hashes password with bcrypt, and invalidates single-use token', async () => {
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

    // Extract generated token from server DB record (simulating user clicking link from email)
    const tokenRecord = db.schema.passwordResetTokens.find((r) => r.email === email && !r.used);
    expect(tokenRecord).toBeDefined();
    expect(tokenRecord!.token).toMatch(/^rst_[a-f0-9]{48}$/);
    const validToken = tokenRecord!.token;

    // Confirm password reset with new password
    const confirmRes = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token: validToken, newPassword });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.message).toContain('successfully updated');

    // Verify token is marked as used in DB immediately
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

  // Requirement: Used token is rejected
  it('3. Rejects already used tokens (single-use enforcement)', async () => {
    const email = `used_token_${Date.now()}@origin-os.internal`;
    await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'Password123!', displayName: 'Used Token User' });

    await request(app)
      .post('/api/auth/password-reset-request')
      .send({ email });

    const tokenRecord = db.schema.passwordResetTokens.find((r) => r.email === email && !r.used);
    const token = tokenRecord!.token;

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

  // Requirement: Expired token is rejected
  it('4. Rejects expired reset tokens', async () => {
    const email = `expired_${Date.now()}@origin-os.internal`;
    await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'Password123!', displayName: 'Expired User' });

    const expiredToken = `rst_expired_${Date.now()}`;
    db.schema.passwordResetTokens.push({
      token: expiredToken,
      email,
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
      used: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    });
    await db.save();

    const res = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token: expiredToken, newPassword: 'BrandNewPassword123!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  // Requirement: Invalid / forged token is rejected
  it('5. Rejects non-existent or forged reset tokens', async () => {
    const res = await request(app)
      .post('/api/auth/password-reset-confirm')
      .send({ token: 'rst_forged_invalid_token_12345', newPassword: 'BrandNewPassword123!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  // Requirement: Rejects short password (< 6 chars) or missing payload
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
});
