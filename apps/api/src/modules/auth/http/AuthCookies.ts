import type { CookieOptions, Request, Response } from 'express';
import type { IssuedTokens } from '../services/SessionService';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
/** The refresh token is only ever sent to the auth endpoints, never to the rest of the API. */
const REFRESH_PATH = '/api/auth';
const GOOGLE_STATE_COOKIE = 'g_oauth';
const GOOGLE_STATE_PATH = '/api/auth/google';
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000; // the user has 10 minutes on Google's screen

export interface CookieSettings {
  sameSite: 'lax' | 'none';
  domain?: string;
  secure: boolean;
}

export interface GoogleOAuthState {
  state: string;
  codeVerifier: string;
}

/**
 * Everything about auth cookies in one place: names, flags, paths, expiry.
 * All of them are httpOnly, so page JavaScript can never read a token:
 * a script injected into the page cannot steal a login.
 */
export class AuthCookies {
  constructor(private readonly settings: CookieSettings) {}

  setTokens(res: Response, tokens: IssuedTokens): void {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...this.base('/'), expires: tokens.accessExpiresAt });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...this.base(REFRESH_PATH), expires: tokens.refreshExpiresAt });
  }

  readAccess(req: Request): string | undefined {
    return this.readPlain(req, ACCESS_COOKIE);
  }

  readRefresh(req: Request): string | undefined {
    return this.readPlain(req, REFRESH_COOKIE);
  }

  clearTokens(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, this.base('/'));
    res.clearCookie(REFRESH_COOKIE, this.base(REFRESH_PATH));
  }

  /** Signed with COOKIE_SECRET so it cannot be forged. SameSite=Lax so it comes back on Google's redirect. */
  setGoogleState(res: Response, data: GoogleOAuthState): void {
    res.cookie(GOOGLE_STATE_COOKIE, JSON.stringify(data), { ...this.googleStateOptions(), maxAge: GOOGLE_STATE_TTL_MS });
  }

  readGoogleState(req: Request): GoogleOAuthState | undefined {
    const raw = req.signedCookies?.[GOOGLE_STATE_COOKIE];
    if (typeof raw !== 'string') return undefined;
    try {
      const parsed = JSON.parse(raw) as Partial<GoogleOAuthState>;
      return typeof parsed.state === 'string' && typeof parsed.codeVerifier === 'string'
        ? { state: parsed.state, codeVerifier: parsed.codeVerifier }
        : undefined;
    } catch {
      return undefined;
    }
  }

  clearGoogleState(res: Response): void {
    res.clearCookie(GOOGLE_STATE_COOKIE, this.googleStateOptions());
  }

  private readPlain(req: Request, name: string): string | undefined {
    const value = req.cookies?.[name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private base(path: string): CookieOptions {
    return { httpOnly: true, secure: this.settings.secure, sameSite: this.settings.sameSite, domain: this.settings.domain, path };
  }

  private googleStateOptions(): CookieOptions {
    return { httpOnly: true, secure: this.settings.secure, sameSite: 'lax', path: GOOGLE_STATE_PATH, signed: true };
  }
}
