import Stripe from 'stripe';
import { db, UserRecord } from './db';

// -------------------------------------------------------------
// STRIPE CONFIGURATION & ERROR HANDLING
// -------------------------------------------------------------

export type StripeConfigurationErrorCode =
  | 'STRIPE_NOT_CONFIGURED'
  | 'STRIPE_SECRET_KEY_MISSING'
  | 'STRIPE_SECRET_KEY_INVALID'
  | 'STRIPE_WEBHOOK_SECRET_MISSING'
  | 'STRIPE_WEBHOOK_SECRET_INVALID'
  | 'STRIPE_PRICE_ID_MISSING'
  | 'STRIPE_PRICE_ID_INVALID';

export class StripeConfigurationError extends Error {
  readonly code: StripeConfigurationErrorCode;
  readonly statusCode: number;

  constructor(
    message: string,
    code: StripeConfigurationErrorCode = 'STRIPE_NOT_CONFIGURED',
    statusCode: number = 503
  ) {
    super(message);
    this.name = 'StripeConfigurationError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, StripeConfigurationError.prototype);
  }
}

/**
 * Validates Stripe secret key string format.
 * Must be a non-empty string, trimmed, without whitespace, and at least 8 characters.
 */
export function isValidStripeSecretKey(key: unknown): boolean {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 8) return false;
  if (/\s/.test(trimmed)) return false;
  return true;
}

/**
 * Validates Stripe webhook secret string format.
 * Must be a non-empty string, trimmed, without whitespace, and at least 8 characters.
 */
export function isValidStripeWebhookSecret(secret: unknown): boolean {
  if (typeof secret !== 'string') return false;
  const trimmed = secret.trim();
  if (trimmed.length < 8) return false;
  if (/\s/.test(trimmed)) return false;
  return true;
}

/**
 * Validates Stripe Price ID string format.
 * Must be a non-empty string, trimmed, without whitespace, and at least 3 characters.
 */
export function isValidStripePriceId(priceId: unknown): boolean {
  if (typeof priceId !== 'string') return false;
  const trimmed = priceId.trim();
  if (trimmed.length < 3) return false;
  if (/\s/.test(trimmed)) return false;
  return true;
}

/**
 * Safely inspects and returns STRIPE_SECRET_KEY.
 * Never leaks the secret value in thrown error messages.
 */
export function getStripeSecretKey(options?: { required?: boolean }): string | null {
  const raw = process.env.STRIPE_SECRET_KEY;
  if (!raw || !raw.trim()) {
    if (options?.required) {
      throw new StripeConfigurationError(
        'Stripe billing is not configured on this server (STRIPE_SECRET_KEY is missing).',
        'STRIPE_SECRET_KEY_MISSING',
        503
      );
    }
    return null;
  }

  const trimmed = raw.trim();
  if (!isValidStripeSecretKey(trimmed)) {
    if (options?.required) {
      throw new StripeConfigurationError(
        'Stripe billing configuration is invalid (STRIPE_SECRET_KEY format is invalid).',
        'STRIPE_SECRET_KEY_INVALID',
        503
      );
    }
    return null;
  }

  return trimmed;
}

/**
 * Safely inspects and returns STRIPE_WEBHOOK_SECRET.
 * Never leaks the secret value in thrown error messages.
 */
export function getStripeWebhookSecret(options?: { required?: boolean }): string | null {
  const raw = process.env.STRIPE_WEBHOOK_SECRET;
  if (!raw || !raw.trim()) {
    if (options?.required ?? true) {
      throw new StripeConfigurationError(
        'Stripe webhook secret is not configured on this server (STRIPE_WEBHOOK_SECRET is missing).',
        'STRIPE_WEBHOOK_SECRET_MISSING',
        503
      );
    }
    return null;
  }

  const trimmed = raw.trim();
  if (!isValidStripeWebhookSecret(trimmed)) {
    if (options?.required ?? true) {
      throw new StripeConfigurationError(
        'Stripe webhook secret configuration is invalid (STRIPE_WEBHOOK_SECRET format is invalid).',
        'STRIPE_WEBHOOK_SECRET_INVALID',
        503
      );
    }
    return null;
  }

  return trimmed;
}

/**
 * Safely inspects and returns STRIPE_PRO_PRICE_ID.
 */
export function getStripeProPriceId(options?: { required?: boolean }): string | null {
  const raw = process.env.STRIPE_PRO_PRICE_ID;
  if (!raw || !raw.trim()) {
    if (options?.required) {
      throw new StripeConfigurationError(
        'Stripe Pro price ID is not configured (STRIPE_PRO_PRICE_ID is missing).',
        'STRIPE_PRICE_ID_MISSING',
        503
      );
    }
    return null;
  }

  const trimmed = raw.trim();
  if (!isValidStripePriceId(trimmed)) {
    throw new StripeConfigurationError(
      'Stripe Pro price ID configuration is invalid (STRIPE_PRO_PRICE_ID format is invalid).',
      'STRIPE_PRICE_ID_INVALID',
      503
    );
  }

  return trimmed;
}

export interface StripeConfigStatus {
  isConfigured: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  hasProPriceId: boolean;
  isSecretKeyValid: boolean;
  isWebhookSecretValid: boolean;
  isProPriceIdValid: boolean;
}

export function getStripeConfigStatus(): StripeConfigStatus {
  const rawKey = process.env.STRIPE_SECRET_KEY;
  const rawWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const rawPrice = process.env.STRIPE_PRO_PRICE_ID;

  const hasSecretKey = Boolean(rawKey && rawKey.trim());
  const hasWebhookSecret = Boolean(rawWebhook && rawWebhook.trim());
  const hasProPriceId = Boolean(rawPrice && rawPrice.trim());

  const isSecretKeyValid = hasSecretKey && isValidStripeSecretKey(rawKey!.trim());
  const isWebhookSecretValid = hasWebhookSecret && isValidStripeWebhookSecret(rawWebhook!.trim());
  const isProPriceIdValid = hasProPriceId && isValidStripePriceId(rawPrice!.trim());

  return {
    isConfigured: isSecretKeyValid,
    hasSecretKey,
    hasWebhookSecret,
    hasProPriceId,
    isSecretKeyValid,
    isWebhookSecretValid,
    isProPriceIdValid,
  };
}

let stripeClient: Stripe | null = null;
let lastUsedKey: string | null = null;
let customMockClientSet = false;

export function resetStripeClientForTesting(): void {
  stripeClient = null;
  lastUsedKey = null;
  customMockClientSet = false;
}

export function setStripeClientForTesting(client: Stripe | null): void {
  stripeClient = client;
  customMockClientSet = Boolean(client);
  if (client) {
    lastUsedKey = process.env.STRIPE_SECRET_KEY || 'mock_key';
  }
}

export function getStripe(options?: { required?: boolean }): Stripe | null {
  const key = getStripeSecretKey(options);
  if (!key) {
    return null;
  }
  if (customMockClientSet && stripeClient) {
    return stripeClient;
  }
  if (!stripeClient || lastUsedKey !== key) {
    stripeClient = new Stripe(key);
    lastUsedKey = key;
  }
  return stripeClient;
}

export function sanitizeStripeSecretsFromError(message: string): string {
  if (!message) return 'Stripe operation failed.';
  let sanitized = message;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey && secretKey.trim()) {
    sanitized = sanitized.split(secretKey.trim()).join('[REDACTED_KEY]');
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret && webhookSecret.trim()) {
    sanitized = sanitized.split(webhookSecret.trim()).join('[REDACTED_KEY]');
  }
  sanitized = sanitized
    .replace(/(?:sk|rk|whsec)_(?:test|live)_[a-zA-Z0-9_*]+/gi, '[REDACTED_KEY]')
    .replace(/(?:sk|rk|whsec)_[a-zA-Z0-9_*]{6,}/gi, '[REDACTED_KEY]');
  return sanitized;
}

export function requireStripe(): Stripe {
  const client = getStripe({ required: true });
  if (!client) {
    throw new StripeConfigurationError(
      'Stripe client failed to initialize.',
      'STRIPE_NOT_CONFIGURED',
      503
    );
  }
  return client;
}

export interface PlanTierConfig {
  id: 'free' | 'pro';
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  description: string;
  features: string[];
  limits: {
    maxActiveHabits: number;
    maxTasks: number;
    maxActiveGoals: number;
    maxAiRequestsPerDay: number;
    hasAdvancedFinances: boolean;
    hasEncryptedVault: boolean;
    hasDeepInsights: boolean;
  };
}

export const PLAN_TIERS: Record<'free' | 'pro', PlanTierConfig> = {
  free: {
    id: 'free',
    name: 'Starter',
    priceMonthly: 0,
    priceAnnual: 0,
    description: 'Essential focus and habit tracking for mindful daily living.',
    features: [
      'Core daily focus loop & task matrix',
      'Up to 3 atomic daily habits',
      '1 active long-term goal',
      '15 AI Co-Pilot messages / day',
      'Basic monthly cashflow tracking',
    ],
    limits: {
      maxActiveHabits: 3,
      maxTasks: 25,
      maxActiveGoals: 1,
      maxAiRequestsPerDay: 15,
      hasAdvancedFinances: false,
      hasEncryptedVault: false,
      hasDeepInsights: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'ORIGIN Pro',
    priceMonthly: 12,
    priceAnnual: 99,
    description: 'Unlimited capacity, deep AI synthesis, and bank-grade privacy vault.',
    features: [
      'Unlimited tasks, habits, and goals',
      'Unlimited AI Co-Pilot & weekly synthesis',
      'Encrypted personal finance & reflection vault',
      'Multi-domain cross-correlation analytics',
      'Bi-directional notes knowledge graph',
      'Priority cloud sync & data exports',
    ],
    limits: {
      maxActiveHabits: 9999,
      maxTasks: 9999,
      maxActiveGoals: 9999,
      maxAiRequestsPerDay: 500,
      hasAdvancedFinances: true,
      hasEncryptedVault: true,
      hasDeepInsights: true,
    },
  },
};

export function checkUserEntitlements(user: UserRecord): {
  tier: 'free' | 'pro';
  plan: PlanTierConfig;
  usage: {
    activeHabitsCount: number;
    tasksCount: number;
    activeGoalsCount: number;
  };
  canCreateHabit: boolean;
  canCreateTask: boolean;
  canCreateGoal: boolean;
} {
  const tier = user.subscription?.tier === 'pro' || user.subscription?.tier === 'lifetime' ? 'pro' : 'free';
  const plan = PLAN_TIERS[tier];

  const activeHabitsCount = db.schema.habits.filter((h) => h.userId === user.id && !h.archived).length;
  const tasksCount = db.schema.tasks.filter((t) => t.userId === user.id && t.status !== 'canceled').length;
  const activeGoalsCount = db.schema.goals.filter((g) => g.userId === user.id && g.status === 'active').length;

  return {
    tier,
    plan,
    usage: {
      activeHabitsCount,
      tasksCount,
      activeGoalsCount,
    },
    canCreateHabit: activeHabitsCount < plan.limits.maxActiveHabits,
    canCreateTask: tasksCount < plan.limits.maxTasks,
    canCreateGoal: activeGoalsCount < plan.limits.maxActiveGoals,
  };
}

export async function createStripeCheckoutSession(
  user: UserRecord,
  interval: 'monthly' | 'annual',
  appUrl: string,
  options?: { requirePriceId?: boolean }
): Promise<{ url: string; mode: 'stripe' }> {
  // Validate that Stripe is configured with a valid secret key
  const stripe = requireStripe();

  // Validate price ID if required or if provided in environment
  let priceId: string | null = null;
  if (options?.requirePriceId) {
    priceId = getStripeProPriceId({ required: true });
  } else if (process.env.STRIPE_PRO_PRICE_ID && process.env.STRIPE_PRO_PRICE_ID.trim()) {
    priceId = getStripeProPriceId({ required: true });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'ORIGIN Pro Life Operating System',
                  description: 'Complete life architecture, unlimited AI Co-Pilot, and encrypted vault.',
                },
                unit_amount: interval === 'annual' ? 9900 : 1200,
                recurring: {
                  interval: interval === 'annual' ? 'year' : 'month',
                },
              },
              quantity: 1,
            },
          ],
      success_url: `${appUrl}/app/settings?billing_status=success`,
      cancel_url: `${appUrl}/app/settings?billing_status=canceled`,
    });

    if (!session || !session.url) {
      throw new Error('Stripe checkout session creation returned an empty session URL.');
    }

    return {
      url: session.url,
      mode: 'stripe',
    };
  } catch (err: any) {
    if (err instanceof StripeConfigurationError) {
      throw err;
    }
    // Sanitize any error from Stripe SDK to ensure secret keys are never exposed in error messages
    const sanitizedMsg = sanitizeStripeSecretsFromError(err?.message);
    throw new Error(sanitizedMsg);
  }
}

export function constructStripeWebhookEvent(
  payload: string | Buffer,
  signature: string | undefined
): Stripe.Event {
  if (!signature || !signature.trim()) {
    throw new StripeConfigurationError(
      'Missing Stripe webhook signature header.',
      'STRIPE_NOT_CONFIGURED',
      400
    );
  }

  const webhookSecret = getStripeWebhookSecret({ required: true });
  const stripe = requireStripe();

  try {
    return stripe.webhooks.constructEvent(payload, signature.trim(), webhookSecret!);
  } catch (err: any) {
    if (err instanceof StripeConfigurationError) {
      throw err;
    }
    throw new StripeConfigurationError(
      'Stripe webhook signature verification failed.',
      'STRIPE_NOT_CONFIGURED',
      400
    );
  }
}
