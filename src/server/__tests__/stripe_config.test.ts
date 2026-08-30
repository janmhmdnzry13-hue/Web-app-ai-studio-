import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import Stripe from 'stripe';
import { apiRouter } from '../routes';
import { db, UserRecord } from '../db';
import { generateToken, generateCryptoToken, hashPassword } from '../auth';
import {
  getStripe,
  requireStripe,
  getStripeSecretKey,
  getStripeWebhookSecret,
  getStripeProPriceId,
  getStripeConfigStatus,
  createStripeCheckoutSession,
  constructStripeWebhookEvent,
  checkUserEntitlements,
  resetStripeClientForTesting,
  setStripeClientForTesting,
  StripeConfigurationError,
  PLAN_TIERS,
} from '../billing';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Stripe Billing Configuration & Safe Error Handling', () => {
  const originalEnv = { ...process.env };
  let authToken: string;
  let testUser: UserRecord;

  beforeEach(async () => {
    // Reset process.env to a clean state
    process.env = { ...originalEnv };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRO_PRICE_ID;
    resetStripeClientForTesting();

    const userId = generateCryptoToken('usr_stripe_test');
    const email = `stripe.test.${Date.now()}@origin-os.internal`;

    testUser = {
      id: userId,
      email,
      passwordHash: hashPassword('StripeSafePass123!'),
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Stripe Tester' },
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

    authToken = generateToken(testUser);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetStripeClientForTesting();
    vi.restoreAllMocks();
  });

  describe('1. Valid Stripe Configuration allows billing operations to proceed', () => {
    it('initializes Stripe and creates a checkout session when configuration is valid', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_valid_secret_key_12345678';
      process.env.STRIPE_PRO_PRICE_ID = 'price_origin_pro_monthly_123';

      const mockSession = {
        id: 'cs_test_mock_session_abc123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_mock_session_abc123',
      };

      const mockCheckoutCreate = vi.fn().mockResolvedValue(mockSession);
      const mockStripeInstance = {
        checkout: {
          sessions: {
            create: mockCheckoutCreate,
          },
        },
      } as unknown as Stripe;

      setStripeClientForTesting(mockStripeInstance);

      const result = await createStripeCheckoutSession(testUser, 'monthly', 'https://origin-os.app');

      expect(result.url).toBe(mockSession.url);
      expect(result.mode).toBe('stripe');
      expect(mockCheckoutCreate).toHaveBeenCalledTimes(1);
      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          customer_email: testUser.email,
          client_reference_id: testUser.id,
          line_items: [{ price: 'price_origin_pro_monthly_123', quantity: 1 }],
        })
      );
    });

    it('returns successful session URL through HTTP POST /api/billing/checkout', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_valid_secret_key_12345678';

      const mockSession = {
        id: 'cs_test_mock_session_endpoint',
        url: 'https://checkout.stripe.com/pay/cs_test_endpoint',
      };
      const mockCheckoutCreate = vi.fn().mockResolvedValue(mockSession);
      setStripeClientForTesting({
        checkout: {
          sessions: {
            create: mockCheckoutCreate,
          },
        },
      } as unknown as Stripe);

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 'annual' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBe(mockSession.url);
      expect(res.body.data.mode).toBe('stripe');
    });
  });

  describe('2. Missing STRIPE_SECRET_KEY is handled safely', () => {
    it('throws StripeConfigurationError and returns 503 when STRIPE_SECRET_KEY is missing', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      expect(() => getStripeSecretKey({ required: true })).toThrow(StripeConfigurationError);
      expect(getStripeSecretKey({ required: false })).toBeNull();
      expect(getStripe()).toBeNull();
      expect(() => requireStripe()).toThrow(StripeConfigurationError);

      await expect(
        createStripeCheckoutSession(testUser, 'monthly', 'https://origin-os.app')
      ).rejects.toThrow(StripeConfigurationError);
    });

    it('returns HTTP 503 Service Unavailable when STRIPE_SECRET_KEY is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 'monthly' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('STRIPE_SECRET_KEY_MISSING');
      expect(res.body.error.message).toContain('STRIPE_SECRET_KEY is missing');
    });

    it('handles empty string or whitespace STRIPE_SECRET_KEY safely as unconfigured', async () => {
      process.env.STRIPE_SECRET_KEY = '   ';

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 'monthly' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('STRIPE_SECRET_KEY_MISSING');
    });
  });

  describe('3. Missing STRIPE_WEBHOOK_SECRET is handled safely where required', () => {
    it('throws StripeConfigurationError when STRIPE_WEBHOOK_SECRET is missing', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      expect(() => getStripeWebhookSecret({ required: true })).toThrow(StripeConfigurationError);
      expect(getStripeWebhookSecret({ required: false })).toBeNull();

      expect(() => constructStripeWebhookEvent('{"type":"ping"}', 't=123,v1=abc')).toThrow(
        StripeConfigurationError
      );
    });

    it('returns HTTP 503 when webhook endpoint is called without configured STRIPE_WEBHOOK_SECRET', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      process.env.STRIPE_SECRET_KEY = 'sk_test_valid_key_12345678';

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', 't=123456,v1=mock_signature')
        .send({ id: 'evt_test_123', type: 'customer.subscription.updated' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('STRIPE_WEBHOOK_SECRET_MISSING');
    });

    it('returns HTTP 400 when webhook signature is missing from headers', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_valid_key_12345678';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_webhook_secret_123456';

      const res = await request(app)
        .post('/api/billing/webhook')
        .send({ id: 'evt_test_123', type: 'customer.subscription.updated' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('signature header');
    });
  });

  describe('4. Missing STRIPE_PRO_PRICE_ID is handled safely where required', () => {
    it('falls back to dynamic line item price_data when STRIPE_PRO_PRICE_ID is not configured', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_valid_key_12345678';
      delete process.env.STRIPE_PRO_PRICE_ID;

      const mockCheckoutCreate = vi.fn().mockResolvedValue({
        id: 'cs_dynamic_price_123',
        url: 'https://checkout.stripe.com/pay/cs_dynamic',
      });
      setStripeClientForTesting({
        checkout: { sessions: { create: mockCheckoutCreate } },
      } as unknown as Stripe);

      const result = await createStripeCheckoutSession(testUser, 'monthly', 'https://origin-os.app');

      expect(result.url).toBe('https://checkout.stripe.com/pay/cs_dynamic');
      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: 'usd',
                unit_amount: 1200,
              }),
            }),
          ],
        })
      );
    });

    it('throws StripeConfigurationError when price ID is explicitly required but missing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_valid_key_12345678';
      delete process.env.STRIPE_PRO_PRICE_ID;

      expect(() => getStripeProPriceId({ required: true })).toThrow(StripeConfigurationError);

      await expect(
        createStripeCheckoutSession(testUser, 'monthly', 'https://origin-os.app', {
          requirePriceId: true,
        })
      ).rejects.toThrow(StripeConfigurationError);
    });

    it('throws StripeConfigurationError when STRIPE_PRO_PRICE_ID is malformed (whitespace/too short)', () => {
      process.env.STRIPE_PRO_PRICE_ID = '   ';
      expect(getStripeProPriceId({ required: false })).toBeNull();

      process.env.STRIPE_PRO_PRICE_ID = 'ab';
      expect(() => getStripeProPriceId({ required: false })).toThrow(StripeConfigurationError);
    });
  });

  describe('5. Invalid Stripe configuration does NOT create a fake successful payment', () => {
    it('does not upgrade user or mutate database when STRIPE_SECRET_KEY is missing', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const userBefore = db.schema.users.find((u) => u.id === testUser.id);
      expect(userBefore?.subscription?.tier).toBe('free');

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 'monthly' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);

      // Verify user in DB was NOT modified or upgraded
      const userAfter = db.schema.users.find((u) => u.id === testUser.id);
      expect(userAfter?.subscription?.tier).toBe('free');
      expect(userAfter?.subscription?.status).toBe('active');

      // Verify no fake sandbox audit logs were created
      const sandboxLogs = db.schema.auditLogs.filter(
        (l) => l.userId === testUser.id && l.action.includes('SANDBOX')
      );
      expect(sandboxLogs.length).toBe(0);
    });

    it('does not upgrade user when STRIPE_SECRET_KEY is malformed', async () => {
      process.env.STRIPE_SECRET_KEY = 'invalid'; // shorter than 8 chars

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 'annual' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('STRIPE_SECRET_KEY_INVALID');

      const userAfter = db.schema.users.find((u) => u.id === testUser.id);
      expect(userAfter?.subscription?.tier).toBe('free');
    });
  });

  describe('6. Stripe secret values NEVER appear in API responses', () => {
    it('does not leak STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET in API responses', async () => {
      const sensitiveSecret = 'sk_test_SUPER_SECRET_KEY_NEVER_LEAK_987654321';
      const sensitiveWebhook = 'whsec_SUPER_SECRET_WEBHOOK_NEVER_LEAK_12345678';
      process.env.STRIPE_SECRET_KEY = sensitiveSecret;
      process.env.STRIPE_WEBHOOK_SECRET = sensitiveWebhook;

      // Mock an error from Stripe checkout
      const mockCheckoutCreate = vi.fn().mockRejectedValue(new Error('Stripe API network timeout'));
      setStripeClientForTesting({
        checkout: { sessions: { create: mockCheckoutCreate } },
      } as unknown as Stripe);

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 'monthly' });

      const responseString = JSON.stringify(res.body);
      expect(responseString).not.toContain(sensitiveSecret);
      expect(responseString).not.toContain('SUPER_SECRET_KEY_NEVER_LEAK');
      expect(responseString).not.toContain(sensitiveWebhook);
    });

    it('does not leak secret values in subscription status endpoint', async () => {
      const sensitiveCustId = 'cus_private_customer_secret_token_123';
      const sensitiveSubId = 'sub_private_subscription_secret_token_456';

      testUser.subscription = {
        tier: 'pro',
        status: 'active',
        stripeCustomerId: sensitiveCustId,
        stripeSubscriptionId: sensitiveSubId,
      };
      await db.save();

      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const responseString = JSON.stringify(res.body);
      expect(responseString).not.toContain(sensitiveCustId);
      expect(responseString).not.toContain(sensitiveSubId);
      expect(res.body.data.subscription.stripeCustomerId).toBeUndefined();
      expect(res.body.data.subscription.stripeSubscriptionId).toBeUndefined();
    });
  });

  describe('7. Stripe secret values NEVER appear in error messages', () => {
    it('sanitizes any Stripe error message containing raw secret tokens', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_secret_key_to_be_redacted_999';

      const mockCheckoutCreate = vi.fn().mockRejectedValue(
        new Error('Invalid API Key provided: sk_test_secret_key_to_be_redacted_999 is unauthorized')
      );
      setStripeClientForTesting({
        checkout: { sessions: { create: mockCheckoutCreate } },
      } as unknown as Stripe);

      await expect(
        createStripeCheckoutSession(testUser, 'monthly', 'https://origin-os.app')
      ).rejects.toThrow();

      try {
        await createStripeCheckoutSession(testUser, 'monthly', 'https://origin-os.app');
      } catch (err: any) {
        expect(err.message).not.toContain('sk_test_secret_key_to_be_redacted_999');
        expect(err.message).toContain('[REDACTED_KEY]');
      }
    });

    it('getStripeConfigStatus reports configuration boolean status without leaking secrets', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_secret_inspection_sample_12345';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_webhook_inspection_sample_12345';
      process.env.STRIPE_PRO_PRICE_ID = 'price_pro_sample_12345';

      const status = getStripeConfigStatus();

      expect(status.isConfigured).toBe(true);
      expect(status.hasSecretKey).toBe(true);
      expect(status.hasWebhookSecret).toBe(true);
      expect(status.hasProPriceId).toBe(true);
      expect(status.isSecretKeyValid).toBe(true);
      expect(status.isWebhookSecretValid).toBe(true);
      expect(status.isProPriceIdValid).toBe(true);

      const statusString = JSON.stringify(status);
      expect(statusString).not.toContain('sk_test_');
      expect(statusString).not.toContain('whsec_');
      expect(statusString).not.toContain('price_');
    });
  });

  describe('8. Existing valid billing behavior remains intact', () => {
    it('accurately checks user entitlements for Starter (free) plan', () => {
      const entitlements = checkUserEntitlements(testUser);
      expect(entitlements.tier).toBe('free');
      expect(entitlements.plan.name).toBe('Starter');
      expect(entitlements.plan.limits.maxActiveHabits).toBe(3);
      expect(entitlements.canCreateHabit).toBe(true);
      expect(entitlements.canCreateTask).toBe(true);
    });

    it('accurately checks user entitlements for Pro plan', () => {
      const proUser: UserRecord = {
        ...testUser,
        subscription: {
          tier: 'pro',
          status: 'active',
        },
      };

      const entitlements = checkUserEntitlements(proUser);
      expect(entitlements.tier).toBe('pro');
      expect(entitlements.plan.name).toBe('ORIGIN Pro');
      expect(entitlements.plan.limits.maxActiveHabits).toBe(9999);
      expect(entitlements.plan.limits.hasEncryptedVault).toBe(true);
      expect(entitlements.plan.limits.hasAdvancedFinances).toBe(true);
    });

    it('returns available plan tiers in subscription endpoint', async () => {
      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.availablePlans).toEqual(PLAN_TIERS);
      expect(res.body.data.tier).toBe('free');
    });
  });
});
