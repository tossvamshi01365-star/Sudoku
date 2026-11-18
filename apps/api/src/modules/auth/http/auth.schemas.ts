import { z } from 'zod';
import { USER_TYPES } from '../../users/user.types';

/**
 * Input rules for every auth endpoint. Each schema is `.strict()`: any field
 * that is not listed here makes the request fail.
 */

const email = z
  .string({ error: 'Please enter your email address.' })
  .trim()
  .toLowerCase()
  .max(254, 'Please enter a valid email address.')
  .pipe(z.email('Please enter a valid email address.'));

/** bcrypt only uses the first 72 bytes of a password, so longer ones are refused instead of silently cut. */
const newPassword = z
  .string({ error: 'Please enter a password.' })
  .min(8, 'Password must be at least 8 characters long.')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 characters long.');

const displayName = z
  .string({ error: 'Please enter a display name.' })
  .trim()
  .min(2, 'Display name must be at least 2 characters.')
  .max(50, 'Display name must be at most 50 characters.')
  // No control characters or angle brackets (blocks invisible text and HTML injection).
  .regex(/^[^\p{C}<>]+$/u, 'Display name contains characters that are not allowed.');

const userType = z.enum(USER_TYPES, { error: 'Please choose whether you bought the book or want to play free.' });

const isAgeConfirmed = z.boolean().optional().default(false);

const token = z.string({ error: 'Missing token.' }).min(20, 'Invalid token.').max(100, 'Invalid token.');

export const registerSchema = z.object({ email, password: newPassword, displayName, userType, isAgeConfirmed }).strict();

export const loginSchema = z
  .object({ email, password: z.string({ error: 'Please enter your password.' }).min(1, 'Please enter your password.').max(200) })
  .strict();

export const emailOnlySchema = z.object({ email }).strict();

export const tokenSchema = z.object({ token }).strict();

export const resetPasswordSchema = z.object({ token, password: newPassword }).strict();

export const completeProfileSchema = z.object({ displayName, userType, isAgeConfirmed }).strict();

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type EmailOnlyBody = z.infer<typeof emailOnlySchema>;
export type TokenBody = z.infer<typeof tokenSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type CompleteProfileBody = z.infer<typeof completeProfileSchema>;
