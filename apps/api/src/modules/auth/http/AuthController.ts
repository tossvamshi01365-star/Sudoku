import type { Request, Response } from 'express';
import { AppError } from '../../../common/errors/AppError';
import { safeEqual } from '../../../common/crypto/tokens';
import type { CsrfProtection } from '../../../common/security/CsrfProtection';
import type { ProfileService } from '../../users/ProfileService';
import { toPublicUser, type User } from '../../users/user.types';
import type { IGoogleOAuthClient } from '../auth.ports';
import type { EmailPasswordAuthService } from '../services/EmailPasswordAuthService';
import type { EmailVerificationService } from '../services/EmailVerificationService';
import type { GoogleAuthService } from '../services/GoogleAuthService';
import type { PasswordResetService } from '../services/PasswordResetService';
import type { SessionService } from '../services/SessionService';
import type { AuthCookies } from './AuthCookies';
import type {
  CompleteProfileBody,
  EmailOnlyBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  TokenBody,
} from './auth.schemas';

export interface AuthControllerDeps {
  emailPassword: EmailPasswordAuthService;
  verification: EmailVerificationService;
  passwordReset: PasswordResetService;
  google: GoogleAuthService;
  /** undefined when Google sign-in is not configured. */
  googleClient?: IGoogleOAuthClient;
  profiles: ProfileService;
  sessions: SessionService;
  cookies: AuthCookies;
  csrf: CsrfProtection;
  frontendUrl: string;
}

const CHECK_INBOX = 'Please check your inbox. If this email can be used, we have sent you a link to continue.';

/**
 * Thin HTTP adapter. It reads already-validated input, calls a service, and
 * writes the response. No business rules live here: they are in the services,
 * which know nothing about Express.
 */
export class AuthController {
  constructor(private readonly deps: AuthControllerDeps) {}

  /** The website calls this first and sends the token back in the X-CSRF-Token header on every POST. */
  csrfToken = async (req: Request, res: Response) => {
    res.json({ csrfToken: this.deps.csrf.getOrIssue(req, res) });
  };

  register = async (req: Request, res: Response) => {
    await this.deps.emailPassword.register(req.body as RegisterBody);
    res.status(202).json({ message: CHECK_INBOX });
  };

  verifyEmail = async (req: Request, res: Response) => {
    await this.deps.verification.verify((req.body as TokenBody).token);
    res.json({ message: 'Your email is confirmed. You can now log in.' });
  };

  resendVerification = async (req: Request, res: Response) => {
    await this.deps.verification.resend((req.body as EmailOnlyBody).email);
    res.status(202).json({ message: CHECK_INBOX });
  };

  login = async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginBody;
    const user = await this.deps.emailPassword.login(email, password);
    await this.startSession(req, res, user);
    // A new CSRF token after login, so a token from before login is never reused.
    const csrfToken = this.deps.csrf.issue(res);
    res.json({ user: toPublicUser(user), next: this.nextPage(user), csrfToken });
  };

  /** Swaps the refresh-token cookie for a new access token + new refresh token. */
  refresh = async (req: Request, res: Response) => {
    const token = this.deps.cookies.readRefresh(req);
    if (!token) throw AppError.unauthorized('NOT_AUTHENTICATED', 'Please log in.');
    try {
      const { user, tokens } = await this.deps.sessions.refresh(token);
      this.deps.cookies.setTokens(res, tokens);
      res.json({ user: toPublicUser(user) });
    } catch (err) {
      // A parallel tab already refreshed: keep the cookies it received.
      if (!(err instanceof AppError && err.code === 'REFRESH_IN_PROGRESS')) this.deps.cookies.clearTokens(res);
      throw err;
    }
  };

  logout = async (req: Request, res: Response) => {
    const token = this.deps.cookies.readRefresh(req);
    if (token) await this.deps.sessions.end(token);
    this.deps.cookies.clearTokens(res);
    res.json({ csrfToken: this.deps.csrf.issue(res) });
  };

  me = async (req: Request, res: Response) => {
    res.json({ user: toPublicUser(req.user as User) });
  };

  completeProfile = async (req: Request, res: Response) => {
    const user = await this.deps.profiles.completeProfile((req.user as User).id, req.body as CompleteProfileBody);
    res.json({ user: toPublicUser(user) });
  };

  forgotPassword = async (req: Request, res: Response) => {
    await this.deps.passwordReset.requestReset((req.body as EmailOnlyBody).email);
    res.status(202).json({ message: 'If an account exists for this email, we have sent a password reset link.' });
  };

  resetPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body as ResetPasswordBody;
    await this.deps.passwordReset.resetPassword(token, password);
    this.deps.cookies.clearTokens(res);
    res.json({ message: 'Your password has been changed. Please log in with your new password.' });
  };

  /** Step 1 of Google sign-in: send the browser to Google's consent screen. */
  googleStart = async (_req: Request, res: Response) => {
    const client = this.requireGoogle();
    const { url, state, codeVerifier } = await client.createAuthorizationRequest();
    this.deps.cookies.setGoogleState(res, { state, codeVerifier });
    res.redirect(302, url);
  };

  /** Step 2: Google sends the browser back here with a one-time code. */
  googleCallback = async (req: Request, res: Response) => {
    const client = this.requireGoogle();
    const saved = this.deps.cookies.readGoogleState(req);
    this.deps.cookies.clearGoogleState(res);

    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;

    // `state` must match the value we stored in the signed cookie, which proves this
    // callback belongs to a sign-in this same browser started (stops login CSRF).
    if (!saved || !code || !state || !safeEqual(state, saved.state)) {
      return this.redirectToLogin(res, 'google_failed');
    }

    try {
      const profile = await client.exchangeCode(code, saved.codeVerifier);
      const user = await this.deps.google.signIn(profile);
      await this.startSession(req, res, user);
      this.deps.csrf.issue(res); // the website fetches it from GET /csrf after the redirect
      res.redirect(302, `${this.deps.frontendUrl}${this.nextPage(user)}`);
    } catch (err) {
      if (!(err instanceof AppError)) console.error('[google sign-in failed]', err);
      const reason = err instanceof AppError && err.code === 'GOOGLE_ACCOUNT_MISMATCH' ? 'google_mismatch' : 'google_failed';
      this.redirectToLogin(res, reason);
    }
  };

  private async startSession(req: Request, res: Response, user: User): Promise<void> {
    // End any older login in this browser so one browser = one login.
    const previous = this.deps.cookies.readRefresh(req);
    if (previous) await this.deps.sessions.end(previous);

    this.deps.cookies.setTokens(res, await this.deps.sessions.start(user.id));
  }

  /** Google sign-ups have not chosen book buyer / free player yet. */
  private nextPage(user: User): string {
    return user.userType === null ? '/complete-profile' : '/dashboard';
  }

  private redirectToLogin(res: Response, error: string): void {
    res.redirect(302, `${this.deps.frontendUrl}/login?error=${encodeURIComponent(error)}`);
  }

  private requireGoogle(): IGoogleOAuthClient {
    if (!this.deps.googleClient) {
      throw AppError.serviceUnavailable('GOOGLE_NOT_CONFIGURED', 'Google sign-in is not available right now.');
    }
    return this.deps.googleClient;
  }
}
