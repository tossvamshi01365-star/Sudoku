import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { generateToken, safeEqual } from '../crypto/tokens';
import { AppError } from '../errors/AppError';

const CSRF_COOKIE = 'csrf';
/** The website sends the token back in this request header. */
export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfCookieSettings {
  sameSite: 'lax' | 'none';
  domain?: string;
  secure: boolean;
  maxAgeMs: number;
}

/**
 * CSRF protection with the "signed double-submit" pattern.
 *
 * 1. The website calls GET /api/auth/csrf. The API puts a random token in a
 *    signed httpOnly cookie AND returns the same token in the JSON body.
 * 2. For every POST/PUT/PATCH/DELETE the website sends it in the
 *    `X-CSRF-Token` header. The API checks header === cookie.
 *
 * A malicious website can make the browser send our cookies, but it can never
 * read the token (CORS blocks reading our responses), so it cannot fill in the
 * header. The cookie is signed with COOKIE_SECRET, so it cannot be planted either.
 */
export class CsrfProtection {
  constructor(private readonly settings: CsrfCookieSettings) {}

  /** Creates a brand-new token (done at login/logout so a token never carries over between users). */
  issue(res: Response): string {
    const token = generateToken();
    res.cookie(CSRF_COOKIE, token, { ...this.cookieOptions(), maxAge: this.settings.maxAgeMs });
    return token;
  }

  /** Returns the browser's current token, or creates one if it has none. */
  getOrIssue(req: Request, res: Response): string {
    return this.read(req) ?? this.issue(res);
  }

  /** Middleware that rejects state-changing requests without a matching token. */
  middleware(): RequestHandler {
    return (req, _res, next) => {
      if (SAFE_METHODS.has(req.method)) return next();
      const header = req.get(CSRF_HEADER);
      const cookie = this.read(req);
      if (!header || !cookie || !safeEqual(header, cookie)) {
        return next(AppError.forbidden('CSRF_TOKEN_INVALID', 'Your security token is missing or expired. Please reload the page and try again.'));
      }
      next();
    };
  }

  private read(req: Request): string | undefined {
    // signedCookies holds `false` when the signature does not match.
    const value = req.signedCookies?.[CSRF_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      signed: true,
      secure: this.settings.secure,
      sameSite: this.settings.sameSite,
      domain: this.settings.domain,
      path: '/',
    };
  }
}
