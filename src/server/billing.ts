import Stripe from 'stripe';
import { db, UserRecord } from './db';
import { logAuditEvent } from './audit';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
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
  appUrl: string
): Promise<{ url: string; mode: 'stripe' | 'sandbox' }> {
  const stripe = getStripe();

  if (!stripe) {
    // Graceful fallback sandbox when Stripe keys are not yet configured in environment
    // Simulates a smooth, verified transition to Pro with immediate audit logging
    user.subscription = {
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + (interval === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
    };
    user.updatedAt = new Date().toISOString();
    await db.save();

    await logAuditEvent(user.id, 'SUBSCRIPTION_UPGRADED_SANDBOX', 'billing', {
      interval,
      tier: 'pro',
      provider: 'sandbox-simulation',
    });

    return {
      url: `${appUrl}/app/settings?billing_status=success&sandbox=true`,
      mode: 'sandbox',
    };
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
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

  return {
    url: session.url || `${appUrl}/app/settings`,
    mode: 'stripe',
  };
}
