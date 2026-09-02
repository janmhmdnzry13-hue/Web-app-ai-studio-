import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Transporter, SendMailOptions, SentMessageInfo } from 'nodemailer';
import { apiRouter } from '../routes';
import { db, UserRecord } from '../db';
import {
  SmtpEmailProvider,
  EmailService,
  emailService,
  sanitizeEmailError,
  EmailMessage,
} from '../email';
import { hashPassword, generateCryptoToken } from '../auth';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Real SMTP Email Delivery for Password Resets', () => {
  const originalEnv = { ...process.env };
  let testUser: UserRecord;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.EMAIL_WEBHOOK_URL;

    emailService.resetProvider();

    const userId = generateCryptoToken('usr_smtp_test');
    const email = `smtp.test.${Date.now()}@origin-os.internal`;

    testUser = {
      id: userId,
      email,
      passwordHash: hashPassword('SmtpPass123!'),
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'SMTP Tester' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: true },
      },
      subscription: {
        tier: 'free',
        status: 'active',
      },
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.users = db.schema.users.filter((u) => u.id !== userId);
    db.schema.users.push(testUser);
    await db.save();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    emailService.resetProvider();
    vi.restoreAllMocks();
  });

  describe('1. A correctly configured SMTP provider attempts real SMTP delivery', () => {
    it('initializes SMTP transport and dispatches password-reset email with reset link', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<smtp_msg_12345@origin-os.internal>',
        accepted: [testUser.email],
        rejected: [],
      } as SentMessageInfo);

      const mockTransporter = {
        sendMail: mockSendMail,
        verify: vi.fn().mockResolvedValue(true),
      } as unknown as Transporter;

      const smtpProvider = new SmtpEmailProvider(
        {
          host: 'smtp.mailgun.org',
          port: 587,
          user: 'postmaster@origin-os.internal',
          pass: 'super_secret_smtp_pass_123',
          from: 'ORIGIN Security <noreply@origin-os.internal>',
        },
        mockTransporter
      );

      const testEmailService = new EmailService();
      testEmailService.setProviderForTesting(smtpProvider);

      const resetToken = 'rst_real_smtp_token_1234567890abcdef1234567890abcdef';
      const result = await testEmailService.sendPasswordResetEmail(
        testUser.email,
        resetToken,
        'https://origin-os.app'
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0] as SendMailOptions;
      expect(callArgs.to).toBe(testUser.email);
      expect(callArgs.from).toBe('ORIGIN Security <noreply@origin-os.internal>');
      expect(callArgs.subject).toBe('Reset your ORIGIN password');
      expect(callArgs.text).toContain('/reset-password?token=rst_real_smtp_token');
      expect(callArgs.html).toContain('/reset-password?token=rst_real_smtp_token');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<smtp_msg_12345@origin-os.internal>');
    });
  });

  describe('2. Successful SMTP acceptance returns success', () => {
    it('returns success=true and messageId when the SMTP server acknowledges message acceptance', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<smtp_ack_998877@smtp.relay.service>',
        accepted: ['recipient@domain.com'],
        rejected: [],
        response: '250 2.0.0 OK: Message accepted for delivery',
      } as SentMessageInfo);

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const provider = new SmtpEmailProvider(
        {
          host: 'mail.smtp-server.net',
          port: 465,
          user: 'admin',
          pass: 'pass',
          from: 'noreply@domain.com',
        },
        mockTransporter
      );

      const res = await provider.sendEmail({
        to: 'recipient@domain.com',
        subject: 'Reset Password',
        text: 'Click here to reset your password',
        html: '<p>Click here to reset your password</p>',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('<smtp_ack_998877@smtp.relay.service>');
      expect(res.error).toBeUndefined();
    });
  });

  describe('3. SMTP connection failure returns failure', () => {
    it('returns success=false when connection to the SMTP server fails (e.g. ECONNREFUSED)', async () => {
      const mockSendMail = vi
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED 192.0.2.1:587'));

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const provider = new SmtpEmailProvider(
        {
          host: '192.0.2.1',
          port: 587,
          from: 'noreply@domain.com',
        },
        mockTransporter
      );

      const res = await provider.sendEmail({
        to: 'recipient@domain.com',
        subject: 'Reset Password',
        text: 'Body text',
        html: '<p>Body text</p>',
      });

      expect(res.success).toBe(false);
      expect(res.messageId).toBeUndefined();
      expect(res.error).toContain('ECONNREFUSED');
    });

    it('returns success=false when connection times out', async () => {
      const mockSendMail = vi
        .fn()
        .mockRejectedValue(new Error('Connection timeout after 10000ms'));

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const provider = new SmtpEmailProvider(
        {
          host: 'unresponsive.smtp.server',
          port: 587,
          from: 'noreply@domain.com',
        },
        mockTransporter
      );

      const res = await provider.sendEmail({
        to: 'recipient@domain.com',
        subject: 'Reset Password',
        text: 'Body',
        html: '<p>Body</p>',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Connection timeout');
    });
  });

  describe('4. SMTP authentication failure returns failure', () => {
    it('returns success=false when SMTP server rejects authentication credentials', async () => {
      process.env.SMTP_USER = 'smtp_auth_user_test';
      process.env.SMTP_PASS = 'super_secret_smtp_password_999';

      const mockSendMail = vi
        .fn()
        .mockRejectedValue(
          new Error(
            '535 5.7.8 Error: authentication failed: Invalid credentials for user smtp_auth_user_test with secret super_secret_smtp_password_999'
          )
        );

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const provider = new SmtpEmailProvider(
        {
          host: 'smtp.auth-test.com',
          port: 587,
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
          from: 'noreply@domain.com',
        },
        mockTransporter
      );

      const res = await provider.sendEmail({
        to: 'recipient@domain.com',
        subject: 'Password Reset',
        text: 'Text',
        html: '<p>Text</p>',
      });

      expect(res.success).toBe(false);
      // Verify raw password is redacted and not exposed
      expect(res.error).not.toContain('super_secret_smtp_password_999');
      expect(res.error).toContain('[REDACTED_PASSWORD]');
    });
  });

  describe('5. Missing SMTP configuration does not report successful delivery', () => {
    it('returns success=false when SMTP_HOST is missing or empty', async () => {
      const providerEmptyHost = new SmtpEmailProvider({
        host: '',
        port: 587,
        from: 'noreply@domain.com',
      });

      const res1 = await providerEmptyHost.sendEmail({
        to: 'recipient@domain.com',
        subject: 'Reset',
        text: 'Text',
        html: '<p>Text</p>',
      });

      expect(res1.success).toBe(false);
      expect(res1.error).toContain('SMTP host is not configured');

      const providerWhitespaceHost = new SmtpEmailProvider({
        host: '   ',
        port: 587,
        from: 'noreply@domain.com',
      });

      const res2 = await providerWhitespaceHost.sendEmail({
        to: 'recipient@domain.com',
        subject: 'Reset',
        text: 'Text',
        html: '<p>Text</p>',
      });

      expect(res2.success).toBe(false);
      expect(res2.error).toContain('SMTP host is not configured');
    });

    it('returns success=false when SMTP port is invalid', async () => {
      const providerInvalidPort = new SmtpEmailProvider({
        host: 'smtp.example.com',
        port: 999999, // out of range
        from: 'noreply@domain.com',
      });

      const res = await providerInvalidPort.sendEmail({
        to: 'recipient@domain.com',
        subject: 'Reset',
        text: 'Text',
        html: '<p>Text</p>',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('SMTP port is invalid');
    });

    it('returns success=false when all recipients are rejected by SMTP server', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<rejected_msg@smtp.net>',
        accepted: [],
        rejected: ['bad-address@invalid.domain'],
      } as SentMessageInfo);

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const provider = new SmtpEmailProvider(
        {
          host: 'smtp.example.com',
          port: 587,
          from: 'noreply@domain.com',
        },
        mockTransporter
      );

      const res = await provider.sendEmail({
        to: 'bad-address@invalid.domain',
        subject: 'Reset',
        text: 'Text',
        html: '<p>Text</p>',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('rejected');
    });
  });

  describe('6. The reset token is never returned through the API', () => {
    it('does not return resetToken in POST /api/auth/password-reset-request response', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<smtp_test_api_123@smtp.server>',
        accepted: [testUser.email],
        rejected: [],
      } as SentMessageInfo);

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const smtpProvider = new SmtpEmailProvider(
        {
          host: 'smtp.active-relay.com',
          port: 587,
          from: 'noreply@origin-os.internal',
        },
        mockTransporter
      );

      emailService.setProviderForTesting(smtpProvider);

      const res = await request(app)
        .post('/api/auth/password-reset-request')
        .send({ email: testUser.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.resetToken).toBeUndefined();
      expect(res.body.data?.resetToken).toBeUndefined();
      expect(res.body.data?.token).toBeUndefined();

      // Ensure the generated token (rst_...) never appears anywhere in the response string
      const responseString = JSON.stringify(res.body);
      expect(responseString).not.toContain('rst_');
      expect(responseString).not.toContain('token');

      // Verify token exists in database for valid confirmation as a secure hash representation
      const tokenRecord = db.schema.passwordResetTokens.find(
        (r) => r.email === testUser.email && !r.used
      );
      expect(tokenRecord).toBeDefined();
      expect(tokenRecord!.token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('7. The reset token is never written to logs', () => {
    it('ensures console logs during reset request never contain the raw reset token', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const infoSpy = vi.spyOn(console, 'info');
      const warnSpy = vi.spyOn(console, 'warn');
      const errorSpy = vi.spyOn(console, 'error');

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<smtp_log_test_123@smtp.server>',
        accepted: [testUser.email],
        rejected: [],
      } as SentMessageInfo);

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const smtpProvider = new SmtpEmailProvider(
        {
          host: 'smtp.logtest.com',
          port: 587,
          from: 'noreply@origin-os.internal',
        },
        mockTransporter
      );

      emailService.setProviderForTesting(smtpProvider);

      await request(app)
        .post('/api/auth/password-reset-request')
        .send({ email: testUser.email });

      const tokenRecord = db.schema.passwordResetTokens.find(
        (r) => r.email === testUser.email && !r.used
      );
      expect(tokenRecord).toBeDefined();
      const tokenHash = tokenRecord!.token;

      // Extract raw token from mockSendMail
      const rawToken = mockSendMail.mock.calls[0]?.[0]?.html?.match(/token=(rst_[a-f0-9]{64})/)?.[1] || '';

      // Inspect all recorded console calls
      const allLoggedMessages = [
        ...logSpy.mock.calls.flat(),
        ...infoSpy.mock.calls.flat(),
        ...warnSpy.mock.calls.flat(),
        ...errorSpy.mock.calls.flat(),
      ]
        .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');

      if (rawToken) {
        expect(allLoggedMessages).not.toContain(rawToken);
      }
      expect(allLoggedMessages).not.toContain(tokenHash);
    });
  });

  describe('8. SMTP credentials are never exposed to the frontend', () => {
    it('sanitizes errors and prevents SMTP passwords or secrets from leaking', () => {
      process.env.SMTP_USER = 'smtp_corporate_user';
      process.env.SMTP_PASS = 'top_secret_smtp_password_98765';
      process.env.SENDGRID_API_KEY = 'SG.secret_key_12345';

      const rawErrorMsg =
        'Authentication failed for user smtp_corporate_user with pass top_secret_smtp_password_98765 using key SG.secret_key_12345 on token rst_0123456789abcdef';

      const sanitized = sanitizeEmailError(rawErrorMsg);

      expect(sanitized).not.toContain('top_secret_smtp_password_98765');
      expect(sanitized).not.toContain('smtp_corporate_user');
      expect(sanitized).not.toContain('SG.secret_key_12345');
      expect(sanitized).not.toContain('rst_0123456789abcdef');

      expect(sanitized).toContain('[REDACTED_PASSWORD]');
      expect(sanitized).toContain('[REDACTED_USER]');
      expect(sanitized).toContain('[REDACTED_KEY]');
      expect(sanitized).toContain('[REDACTED_TOKEN]');
    });

    it('does not expose SMTP environment variables in public API responses', async () => {
      process.env.SMTP_HOST = 'smtp.private-internal.net';
      process.env.SMTP_PASS = 'SECRET_SMTP_PASS_NEVER_LEAK';
      process.env.SMTP_USER = 'admin_smtp_user';

      const res = await request(app).get('/api/billing/subscription');
      const responseText = JSON.stringify(res.body);

      expect(responseText).not.toContain('smtp.private-internal.net');
      expect(responseText).not.toContain('SECRET_SMTP_PASS_NEVER_LEAK');
      expect(responseText).not.toContain('admin_smtp_user');
    });
  });

  describe('9. API failure reporting when SMTP delivery fails', () => {
    it('returns HTTP 503 and failure when SMTP provider fails to deliver email for an existing user', async () => {
      const mockSendMail = vi
        .fn()
        .mockRejectedValue(new Error('SMTP connect ETIMEDOUT 198.51.100.1:587'));

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const failingProvider = new SmtpEmailProvider(
        {
          host: '198.51.100.1',
          port: 587,
          from: 'noreply@origin-os.internal',
        },
        mockTransporter
      );

      emailService.setProviderForTesting(failingProvider);

      const res = await request(app)
        .post('/api/auth/password-reset-request')
        .send({ email: testUser.email });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_DELIVERY_FAILED');
      expect(res.body.error.message).toContain('Unable to deliver password reset email');
      // Verify no sensitive token or server internals are exposed
      expect(JSON.stringify(res.body)).not.toContain('ETIMEDOUT');
      expect(JSON.stringify(res.body)).not.toContain('rst_');
    });
  });

  describe('10. Missing production email configuration fails honestly and never reports fake success', () => {
    it('returns HTTP 503 and fails honestly when no email provider is configured in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SMTP_HOST;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.EMAIL_WEBHOOK_URL;

      emailService.resetProvider();

      expect(emailService.getProvider().name).toBe('unconfigured');
      expect(emailService.getProvider().isRealDelivery).toBe(false);
      expect(emailService.isConfigured()).toBe(false);
      expect(emailService.isRealDeliveryConfigured()).toBe(false);

      // Direct service call fails honestly
      const directResult = await emailService.sendPasswordResetEmail(testUser.email, 'rst_test_token_123');
      expect(directResult.success).toBe(false);
      expect(directResult.error).toContain('No production email provider is configured');

      // API request fails honestly with HTTP 503 and does not report fake success
      const res = await request(app)
        .post('/api/auth/password-reset-request')
        .send({ email: testUser.email });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_SERVICE_UNCONFIGURED');
      expect(res.body.error.message).toContain('temporarily unavailable');
      expect(JSON.stringify(res.body)).not.toContain('rst_');
    });

    it('never silently selects DevelopmentEmailProvider in production mode', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SMTP_HOST;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.EMAIL_WEBHOOK_URL;

      const service = new EmailService();
      expect(service.getProvider().name).toBe('unconfigured');
      expect(service.getProvider().name).not.toBe('development');
      expect(service.isConfigured()).toBe(false);
    });

    it('distinguishes development provider from real production delivery in non-production mode', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SMTP_HOST;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.EMAIL_WEBHOOK_URL;

      const service = new EmailService();
      expect(service.getProvider().name).toBe('development');
      expect(service.getProvider().isRealDelivery).toBe(false);
      expect(service.isRealDeliveryConfigured()).toBe(false);
    });
  });
});
