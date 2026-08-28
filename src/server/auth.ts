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

export interface SafePublicUser {
  id: string;
  email: string;
  role: 'member' | 'admin' | 'guest';
  emailVerified: boolean;
  profile: UserRecord['profile'];
  preferences: UserRecord['preferences'];
  subscription?: UserRecord['subscription'];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strips sensitive credentials (passwordHash, verificationToken, resetPasswordToken)
 * by constructing an explicit safe public user object with strict property whitelisting.
 */
export function toPublicUser(user: UserRecord): SafePublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.emailVerified),
    profile: {
      displayName: user.profile?.displayName || '',
      headline: user.profile?.headline || '',
      bio: user.profile?.bio || '',
      avatarUrl: user.profile?.avatarUrl,
      primaryLifeFocus: user.profile?.primaryLifeFocus || '',
    },
    preferences: {
      theme: user.preferences?.theme || 'system',
      timezone: user.preferences?.timezone || 'UTC',
      locale: user.preferences?.locale || 'en-US',
      weekStartDay: user.preferences?.weekStartDay ?? 1,
      reducedMotion: Boolean(user.preferences?.reducedMotion),
      compactDensity: Boolean(user.preferences?.compactDensity),
      dailyReflectionReminderTime: user.preferences?.dailyReflectionReminderTime ?? null,
      notificationChannels: user.preferences?.notificationChannels || { inApp: true, email: false, dailyDigest: false },
    },
    subscription: user.subscription,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
