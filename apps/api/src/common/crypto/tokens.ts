import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A random, URL-safe secret (256 bits). Used for session, verification and reset tokens. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens are stored only as SHA-256 hashes. If the database ever leaks,
 * the stored values cannot be used to log in or reset a password.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time string comparison, so attackers cannot guess a secret by timing responses. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
