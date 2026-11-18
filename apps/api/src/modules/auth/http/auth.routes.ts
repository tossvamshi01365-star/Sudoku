import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../../common/middleware/validateBody';
import { byBodyEmail, byIp, byUser, type RateLimiterFactory } from '../../../common/rate-limit/rateLimit';
import type { AuthController } from './AuthController';
import {
  completeProfileSchema,
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from './auth.schemas';

const MIN = 60 * 1000;

/**
 * Wires URLs to controller methods. (The CSRF check for every POST runs
 * earlier, for the whole app, in app.ts.) Each route runs, in order:
 *   1. a per-IP rate limit (before any work is done),
 *   2. input validation (only the expected fields survive),
 *   3. a per-email or per-user rate limit,
 *   4. the controller.
 */
export function createAuthRouter(controller: AuthController, limit: RateLimiterFactory, requireAuth: RequestHandler): Router {
  const router = Router();

  const tooMany = 'Too many attempts. Please wait a few minutes and try again.';
  const ip = (name: string, max: number, windowMs: number) => limit({ name: `${name}:ip`, max, windowMs, key: byIp, message: tooMany });
  const email = (name: string, max: number, windowMs: number) =>
    limit({ name: `${name}:email`, max, windowMs, key: byBodyEmail, message: tooMany });
  const user = (name: string, max: number, windowMs: number) =>
    limit({ name: `${name}:user`, max, windowMs, key: byUser, message: tooMany });

  router.get('/csrf', ip('csrf', 60, 15 * MIN), controller.csrfToken);

  router.post('/register', ip('register', 5, 15 * MIN), validateBody(registerSchema), email('register', 3, 15 * MIN), controller.register);
  router.post('/verify-email', ip('verify', 20, 15 * MIN), validateBody(tokenSchema), controller.verifyEmail);
  router.post('/resend-verification', ip('resend', 5, 30 * MIN), validateBody(emailOnlySchema), email('resend', 3, 30 * MIN), controller.resendVerification);

  router.post('/login', ip('login', 10, 15 * MIN), validateBody(loginSchema), email('login', 5, 15 * MIN), controller.login);
  // Every open tab refreshes about every 12 minutes, so this limit is generous.
  router.post('/refresh', ip('refresh', 60, 15 * MIN), controller.refresh);
  router.post('/logout', ip('logout', 30, 15 * MIN), controller.logout);
  router.get('/me', requireAuth, controller.me);
  router.post('/complete-profile', ip('profile', 10, 15 * MIN), requireAuth, validateBody(completeProfileSchema), user('profile', 5, 15 * MIN), controller.completeProfile);

  router.post('/forgot-password', ip('forgot', 5, 30 * MIN), validateBody(emailOnlySchema), email('forgot', 3, 30 * MIN), controller.forgotPassword);
  router.post('/reset-password', ip('reset', 10, 30 * MIN), validateBody(resetPasswordSchema), controller.resetPassword);

  router.get('/google', ip('google', 20, 15 * MIN), controller.googleStart);
  router.get('/google/callback', ip('google-callback', 20, 15 * MIN), controller.googleCallback);

  return router;
}
