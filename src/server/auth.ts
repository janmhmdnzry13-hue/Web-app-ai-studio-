import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, UserRecord } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'origin-jwt-production-secret-auth-token-2026';
const TOKEN_EXPIRY = '7d';

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  userId?: string;
}

export function hashPassword(plainText: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

export function verifyPassword(plainText: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plainText, hash);
  } catch {
    return false;
  }
}

export function generateToken(user: UserRecord): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
  } catch {
    return null;
  }
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
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Session has expired or is invalid. Please sign in again.' },
    });
    return;
  }

  const user = db.schema.users.find((u) => u.id === payload.userId);
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
    const payload = verifyToken(token);
    if (payload) {
      const user = db.schema.users.find((u) => u.id === payload.userId);
      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    }
  }
  next();
}

export function generateCryptoToken(prefix = 'tok'): string {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}
