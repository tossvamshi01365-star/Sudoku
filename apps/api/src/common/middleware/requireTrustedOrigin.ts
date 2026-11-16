import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection. Browsers always send an Origin header on POST/PUT/DELETE,
 * so any state-changing request must come from our own website. A malicious
 * site cannot make a logged-in user's browser change anything here.
 */
export function requireTrustedOrigin(allowedOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    if (req.get('origin') !== allowedOrigin) {
      return next(AppError.forbidden('UNTRUSTED_ORIGIN', 'Request blocked.'));
    }
    next();
  };
}
