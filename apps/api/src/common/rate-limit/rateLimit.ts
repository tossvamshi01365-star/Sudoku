import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

/** Where hit counts are kept. In-memory today; a Redis store can replace it later without changing any route. */
export interface IRateLimitStore {
  /** Records one hit for `key` and returns the count inside the current window. */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

/**
 * Fixed-window counter kept in this process's memory.
 * Good for a single server. With several servers, use a shared (Redis) store.
 */
export class MemoryRateLimitStore implements IRateLimitStore {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(cleanupEveryMs = 60_000) {
    // Periodically forget finished windows so memory does not grow forever.
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
    }, cleanupEveryMs);
    timer.unref();
  }

  async hit(key: string, windowMs: number) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.hits.set(key, fresh);
      return fresh;
    }
    entry.count += 1;
    return entry;
  }
}

export interface RateLimitRule {
  /** Unique name, e.g. "login:ip". */
  name: string;
  windowMs: number;
  max: number;
  /** Which bucket this request counts against (IP, email...). Return undefined to skip. */
  key: (req: Request) => string | undefined;
  message: string;
}

export type RateLimiterFactory = (rule: RateLimitRule) => RequestHandler;

export function createRateLimiter(store: IRateLimitStore): RateLimiterFactory {
  return (rule) => async (req, res, next) => {
    const key = rule.key(req);
    if (!key) return next();

    const { count, resetAt } = await store.hit(`${rule.name}:${key}`, rule.windowMs);
    if (count > rule.max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
      return next(AppError.tooManyRequests(rule.message));
    }
    next();
  };
}

/** Rate-limit keys. Use per-email keys only AFTER validateBody, so the email is already normalized. */
export const byIp = (req: Request) => req.ip;
export const byBodyEmail = (req: Request) =>
  typeof req.body?.email === 'string' ? (req.body.email as string) : undefined;
export const byUser = (req: Request) => req.user?.id;
