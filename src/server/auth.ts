import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, UserRecord } from './db';

const TOKEN_EXPIRY = '7d';

/**
 * Resolves the JWT secret.
 * In production mode, fails fast if JWT_SECRET is missing or using an insecure default.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    const trimmed = secret ? secret.trim() : '';
    const isWeakOrPlaceholder =
      !trimmed ||
      trimmed.length < 16 ||
      trimmed === 'origin-jwt-production-secret-auth-token-2026' ||
      trimmed === 'origin-dev-test-jwt-secret-not-for-production-2026' ||
      trimmed.toLowerCase().includes('dev-test') ||
      trimmed.toLowerCase().includes('test-dev');

    if (isWeakOrPlaceholder) {
      throw new Error('CRITICAL_SECURITY_ERROR: JWT_SECRET environment variable is required and must be configured in production.');
    }
    return secret!;
  }
  // Development and test fallback strictly for non-production environments
  return secret || 'origin-dev-test-jwt-secret-not-for-production-2026';
}

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  userId?: string;
}

export interface SafePublicSubscription {
  tier: 'free' | 'pro' | 'lifetime';
  status: 'active' | 'trialing' | 'canceled' | 'past_due';
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface SafePublicProfile {
  displayName: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  primaryLifeFocus?: string;
}

export interface SafePublicPreferences {
  theme: 'system' | 'light' | 'dark';
  timezone: string;
  locale: string;
  weekStartDay: 0 | 1 | 6;
  reducedMotion: boolean;
  compactDensity: boolean;
  dailyReflectionReminderTime: string | null;
  notificationChannels: {
    inApp: boolean;
    email: boolean;
    dailyDigest: boolean;
  };
  unlockedModules?: string[];
}

export interface SafePublicUser {
  id: string;
  email: string;
  role: 'member' | 'admin' | 'guest';
  emailVerified: boolean;
  profile: SafePublicProfile;
  preferences: SafePublicPreferences;
  subscription?: SafePublicSubscription;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Safely transforms a subscription object, omitting private stripe customer/subscription identifiers.
 */
export function toPublicSubscription(sub?: UserRecord['subscription']): SafePublicSubscription | undefined {
  if (!sub) return undefined;
  return {
    tier: sub.tier || 'free',
    status: sub.status || 'active',
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

/**
 * Strips sensitive credentials (passwordHash, verificationToken, resetPasswordToken, private stripe IDs)
 * by constructing an explicit safe public user object with strict property whitelisting.
 */
export function toPublicUser(user: UserRecord | any): SafePublicUser {
  if (!user || typeof user !== 'object') {
    throw new Error('Invalid user object provided for serialization');
  }

  const safeProfile: SafePublicProfile = {
    displayName: typeof user.profile?.displayName === 'string' ? user.profile.displayName : '',
    headline: typeof user.profile?.headline === 'string' ? user.profile.headline : '',
    bio: typeof user.profile?.bio === 'string' ? user.profile.bio : '',
    avatarUrl: typeof user.profile?.avatarUrl === 'string' ? user.profile.avatarUrl : undefined,
    primaryLifeFocus: typeof user.profile?.primaryLifeFocus === 'string' ? user.profile.primaryLifeFocus : '',
  };

  const safePreferences: SafePublicPreferences = {
    theme: user.preferences?.theme === 'light' || user.preferences?.theme === 'dark' ? user.preferences.theme : 'system',
    timezone: typeof user.preferences?.timezone === 'string' ? user.preferences.timezone : 'UTC',
    locale: typeof user.preferences?.locale === 'string' ? user.preferences.locale : 'en-US',
    weekStartDay: user.preferences?.weekStartDay === 0 || user.preferences?.weekStartDay === 6 ? user.preferences.weekStartDay : 1,
    reducedMotion: Boolean(user.preferences?.reducedMotion),
    compactDensity: Boolean(user.preferences?.compactDensity),
    dailyReflectionReminderTime:
      typeof user.preferences?.dailyReflectionReminderTime === 'string'
        ? user.preferences.dailyReflectionReminderTime
        : user.preferences?.dailyReflectionReminderTime === null
        ? null
        : '21:00',
    notificationChannels: {
      inApp: user.preferences?.notificationChannels?.inApp !== false,
      email: Boolean(user.preferences?.notificationChannels?.email),
      dailyDigest: Boolean(user.preferences?.notificationChannels?.dailyDigest),
    },
    unlockedModules: Array.isArray(user.preferences?.unlockedModules)
      ? user.preferences.unlockedModules
      : ['tasks', 'habits', 'finances', 'goals'],
  };

  return {
    id: String(user.id || ''),
    email: String(user.email || ''),
    role: user.role === 'admin' ? 'admin' : user.role === 'guest' ? 'guest' : 'member',
    emailVerified: Boolean(user.emailVerified),
    profile: safeProfile,
    preferences: safePreferences,
    subscription: toPublicSubscription(user.subscription),
    lastLoginAt: typeof user.lastLoginAt === 'string' ? user.lastLoginAt : null,
    createdAt: typeof user.createdAt === 'string' ? user.createdAt : new Date().toISOString(),
    updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : new Date().toISOString(),
  };
}

export function hashPassword(plainText: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

export function verifyPassword(plainText: string, hash: string): boolean {
  if (!plainText || !hash) return false;
  try {
    return bcrypt.compareSync(plainText, hash);
  } catch {
    return false;
  }
}

export function generateToken(user: UserRecord): string {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export interface TokenVerificationResult {
  valid: boolean;
  expired: boolean;
  payload: { userId: string; email: string; role: string } | null;
}

export function inspectToken(token: string): TokenVerificationResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, expired: false, payload: null };
  }
  try {
    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret) as { userId: string; email: string; role: string };
    return { valid: true, expired: false, payload };
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError || err?.name === 'TokenExpiredError') {
      return { valid: false, expired: true, payload: null };
    }
    return { valid: false, expired: false, payload: null };
  }
}

export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  return inspectToken(token).payload;
}

// Authentication Middleware enforcing valid bearer session token
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' },
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication token is missing.' },
    });
    return;
  }

  const verification = inspectToken(token);
  if (!verification.valid) {
    const errorCode = verification.expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    const message = verification.expired
      ? 'Session has expired. Please sign in again.'
      : 'Session has expired or is invalid. Please sign in again.';
    res.status(401).json({
      success: false,
      error: { code: errorCode, message },
    });
    return;
  }

  const user = db.schema.users.find((u) => u.id === verification.payload!.userId);
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User account no longer exists.' },
    });
    return;
  }

  req.user = user;
  req.userId = user.id;
  next();
}

// Optional Auth Middleware for endpoints that can adapt to logged-in users
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const user = db.schema.users.find((u) => u.id === payload.userId);
        if (user) {
          req.user = user;
          req.userId = user.id;
        }
      }
    }
  }
  next();
}

export function generateCryptoToken(prefix = 'tok'): string {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}
