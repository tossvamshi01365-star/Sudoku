import { createApp } from '../src/app';
import { createRateLimiter, MemoryRateLimitStore } from '../src/common/rate-limit/rateLimit';
import { CsrfProtection } from '../src/common/security/CsrfProtection';
import { AuthController } from '../src/modules/auth/http/AuthController';
import { AuthCookies } from '../src/modules/auth/http/AuthCookies';
import { createRequireAuth } from '../src/modules/auth/http/requireAuth';
import { JwtAccessTokenService } from '../src/modules/auth/infrastructure/JwtAccessTokenService';
import { AuthEmailComposer } from '../src/modules/auth/services/AuthEmailComposer';
import { EmailPasswordAuthService } from '../src/modules/auth/services/EmailPasswordAuthService';
import { EmailVerificationService } from '../src/modules/auth/services/EmailVerificationService';
import { GoogleAuthService } from '../src/modules/auth/services/GoogleAuthService';
import { PasswordResetService } from '../src/modules/auth/services/PasswordResetService';
import { SessionService } from '../src/modules/auth/services/SessionService';
import { ContestSettings } from '../src/modules/settings/settings';
import { ProfileService } from '../src/modules/users/ProfileService';
import {
  CapturingEmailSender,
  FakeGoogleClient,
  FakePasswordHasher,
  FakeSettings,
  InMemoryAuthTokenRepository,
  InMemoryRefreshTokenRepository,
  InMemorySettingsRepository,
  InMemoryUserRepository,
} from './fakes';

export const FRONTEND = 'http://localhost:3000';
export const ACCESS_TTL_MS = 12 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A clock the tests can move forward, shared by the JWT service and SessionService. */
export class TestClock {
  ms = Date.UTC(2026, 10, 16, 12, 0, 0);
  now = () => this.ms;
  advance(ms: number) {
    this.ms += ms;
  }
}

/**
 * Same wiring as src/container.ts, but with in-memory fakes instead of Postgres,
 * bcrypt, SMTP and Google. The JWT signing is the REAL implementation.
 */
export function buildTestSystem() {
  const clock = new TestClock();
  const users = new InMemoryUserRepository();
  const refreshRepo = new InMemoryRefreshTokenRepository();
  const tokenRepo = new InMemoryAuthTokenRepository();
  const hasher = new FakePasswordHasher();
  const mailer = new CapturingEmailSender();
  const settings = new FakeSettings();
  const googleClient = new FakeGoogleClient();
  const settingsRows = new InMemorySettingsRepository({
    brand_name: 'Vamshi Finance',
    per_puzzle_prize_usd: 1000,
    admin_only_secret_setting: 'must never be public',
  });
  const accessTokens = new JwtAccessTokenService({
    secret: 'test-jwt-secret-that-is-at-least-32-characters',
    ttlMs: ACCESS_TTL_MS,
    issuer: 'http://localhost:4100',
    audience: FRONTEND,
    now: clock.now,
  });

  const composer = new AuthEmailComposer(settings, FRONTEND);
  const sessions = new SessionService(accessTokens, refreshRepo, users, REFRESH_TTL_MS, clock.now);
  const verification = new EmailVerificationService(users, tokenRepo, composer, mailer);
  const emailPassword = new EmailPasswordAuthService(users, hasher, settings, verification, composer, mailer);
  const passwordReset = new PasswordResetService(users, tokenRepo, hasher, sessions, composer, mailer);
  const google = new GoogleAuthService(users);
  const profiles = new ProfileService(users, settings);
  const cookies = new AuthCookies({ sameSite: 'lax', secure: false });
  const csrf = new CsrfProtection({ sameSite: 'lax', secure: false, maxAgeMs: REFRESH_TTL_MS });

  const authController = new AuthController({
    emailPassword, verification, passwordReset, google, googleClient, profiles, sessions, cookies, csrf, frontendUrl: FRONTEND,
  });

  const app = createApp(
    { frontendUrl: FRONTEND, cookieSecret: 'test-cookie-secret-that-is-at-least-32-chars', trustProxy: 0 },
    {
      authController,
      requireAuth: createRequireAuth(sessions, cookies),
      rateLimiter: createRateLimiter(new MemoryRateLimitStore()),
      csrf,
      publicSettings: new ContestSettings(settingsRows),
    },
  );

  return {
    app, clock, users, refreshRepo, tokenRepo, mailer, settings, googleClient, accessTokens,
    sessions, emailPassword, verification, passwordReset, google, profiles,
  };
}
