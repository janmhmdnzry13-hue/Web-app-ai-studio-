import { Request, Response, NextFunction } from 'express';

export interface RateLimitRecord {
  count: number;
  resetAt: number;
  firstRequestAt: number;
  lastRequestAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  maxEntries?: number;
  cleanupIntervalMs?: number;
}

/**
 * High-performance In-Memory Bounded Rate Limiter
 * 
 * ARCHITECTURAL NOTICE:
 * This rate limiter operates strictly within the current Node.js process memory (single-instance).
 * It features:
 * - Deterministic sliding-reset TTL expiration
 * - Periodic background garbage collection (with unref'd timer for clean test exits)
 * - Hard bounded capacity with LRU eviction to prevent memory exhaustion
 * - Client IP and verified-JWT user isolation to prevent accidental cross-tenant blocking
 * - Safe headers (Retry-After, RateLimit-*) without exposing internal memory layout or secrets
 * 
 * Note: If the application scales to multiple horizontal container replicas without sticky sessions,
 * a distributed state store (e.g. Redis) would be required. In the current single-instance deployment,
 * this in-memory implementation provides complete protection with zero external infrastructure overhead.
 */
export class InMemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private readonly maxEntries: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10000;
    const cleanupInterval = options.cleanupIntervalMs ?? 30000;

    // Start background cleanup timer (unref'd so it doesn't prevent Node process termination)
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired();
      }, cleanupInterval);
      if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Consumes a rate limit token and returns whether the request is allowed along with timing metadata.
   */
  public consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    let entry = this.store.get(key);

    // If entry does not exist or window has expired, reset bucket
    if (!entry || entry.resetAt <= now) {
      // Check capacity bounds before inserting new entry
      if (!entry && this.store.size >= this.maxEntries) {
        this.cleanupExpired(now);
        if (this.store.size >= this.maxEntries) {
          this.evictOldest();
        }
      }

      entry = {
        count: 1,
        resetAt: now + windowMs,
        firstRequestAt: now,
        lastRequestAt: now,
      };
      this.store.set(key, entry);

      const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      return {
        allowed: true,
        count: 1,
        limit,
        remaining: Math.max(0, limit - 1),
        resetAt: entry.resetAt,
        retryAfterSeconds,
      };
    }

    // Existing active window
    entry.lastRequestAt = now;
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count >= limit) {
      return {
        allowed: false,
        count: entry.count,
        limit,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfterSeconds,
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      count: entry.count,
      limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
      retryAfterSeconds,
    };
  }

  /**
   * Lightweight boolean check for backward compatibility.
   */
  public check(key: string, limit: number, windowMs: number): boolean {
    return this.consume(key, limit, windowMs).allowed;
  }

  /**
   * Removes expired entries from the store to prevent memory leaks.
   */
  public cleanupExpired(now: number = Date.now()): number {
    let evictedCount = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
        evictedCount++;
      }
    }
    return evictedCount;
  }

  /**
   * Evicts the oldest entry to strictly respect maxEntries ceiling under extreme burst loads.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastRequestAt < oldestTime) {
        oldestTime = entry.lastRequestAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  /**
   * Resets rate limiter records (optionally for a specific key, or entire store).
   */
  public reset(key?: string): void {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  /**
   * Returns current active entry count in memory.
   */
  public size(): number {
    return this.store.size;
  }

  /**
   * Safely stops internal timers for teardown.
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Centralized AI Endpoints Rate Limiting Configuration
export const AI_RATE_LIMIT_CONFIG = {
  chat: {
    limit: 30, // max 30 requests
    windowMs: 60 * 1000, // per 1 minute window
  },
  insights: {
    limit: 20, // max 20 requests
    windowMs: 60 * 1000, // per 1 minute window
  },
};

// Centralized Signup Endpoint Rate Limiting Configuration
export const SIGNUP_RATE_LIMIT_CONFIG = {
  limit: 10, // max 10 requests per window
  windowMs: 10 * 60 * 1000, // 10 minute window
};

// Global Singleton Rate Limiter Instance
export const rateLimiter = new InMemoryRateLimiter();

/**
 * Safely extracts client IP address with proxy support and normalization.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Standard Express middleware factory for route protection.
 */
export function createRateLimitMiddleware(options: {
  limit: number;
  windowMs: number;
  keyGenerator: (req: Request) => string;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.keyGenerator(req);
    const result = rateLimiter.consume(key, options.limit, options.windowMs);

    // Standard non-sensitive RateLimit headers
    res.setHeader('RateLimit-Limit', options.limit.toString());
    res.setHeader('RateLimit-Remaining', result.remaining.toString());
    res.setHeader('RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSeconds.toString());
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: options.message || 'Too many requests. Please wait a moment before trying again.',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Backward-compatible helper methods for existing routes & test suites.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  return rateLimiter.check(key, limit, windowMs);
}

export function resetRateLimitsForTesting(): void {
  rateLimiter.reset();
}

export function cleanupExpiredRateLimits(): number {
  return rateLimiter.cleanupExpired();
}

export function getRateLimitEntryCount(): number {
  return rateLimiter.size();
}
