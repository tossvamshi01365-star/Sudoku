import type { RequestHandler } from 'express';
import { AppError } from '../../../common/errors/AppError';
import type { SessionService } from '../services/SessionService';
import type { AuthCookies } from './AuthCookies';

/**
 * Guard for routes that need a logged-in player.
 * It checks the access-token JWT, then reloads the user from the database on
 * every request (never trusting anything stored in the browser) and attaches it as req.user.
 *
 * An expired token answers 401 with code ACCESS_TOKEN_EXPIRED: the website then
 * calls POST /api/auth/refresh once and retries the request.
 */
export function createRequireAuth(sessions: SessionService, cookies: AuthCookies): RequestHandler {
  return async (req, _res, next) => {
    const token = cookies.readAccess(req);
    const result = token ? await sessions.authenticate(token) : null;

    if (result === 'expired') {
      return next(AppError.unauthorized('ACCESS_TOKEN_EXPIRED', 'Your session needs to be refreshed.'));
    }
    if (!result) {
      return next(AppError.unauthorized('NOT_AUTHENTICATED', 'Please log in.'));
    }
    req.user = result;
    next();
  };
}
