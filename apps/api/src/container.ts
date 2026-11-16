import type { DataSource } from 'typeorm';
import type { AppConfig } from './config/env';
import { createRateLimiter, MemoryRateLimitStore, type RateLimiterFactory } from './common/rate-limit/rateLimit';
import { CsrfProtection } from './common/security/CsrfProtection';
import type { IEmailSender } from './modules/auth/auth.ports';
import { AuthTokenEntity } from './modules/auth/entities/auth-token.entity';
import { RefreshTokenEntity } from './modules/auth/entities/refresh-token.entity';
import { AuthController } from './modules/auth/http/AuthController';
import { AuthCookies } from './modules/auth/http/AuthCookies';
import { createRequireAuth } from './modules/auth/http/requireAuth';
import { BcryptPasswordHasher } from './modules/auth/infrastructure/BcryptPasswordHasher';
import { ConsoleEmailSender, SmtpEmailSender } from './modules/auth/infrastructure/emailSenders';
import { GoogleOAuthClient } from './modules/auth/infrastructure/GoogleOAuthClient';
import { JwtAccessTokenService } from './modules/auth/infrastructure/JwtAccessTokenService';
import { TypeOrmAuthTokenRepository } from './modules/auth/infrastructure/TypeOrmAuthTokenRepository';
import { TypeOrmRefreshTokenRepository } from './modules/auth/infrastructure/TypeOrmRefreshTokenRepository';
import { AuthEmailComposer } from './modules/auth/services/AuthEmailComposer';
import { EmailPasswordAuthService } from './modules/auth/services/EmailPasswordAuthService';
import { EmailVerificationService } from './modules/auth/services/EmailVerificationService';
import { GoogleAuthService } from './modules/auth/services/GoogleAuthService';
import { PasswordResetService } from './modules/auth/services/PasswordResetService';
import { SessionService } from './modules/auth/services/SessionService';
import { SettingEntity } from './modules/settings/setting.entity';
import { ContestSettings, TypeOrmSettingsRepository, type IPublicSettings } from './modules/settings/settings';
import { ProfileService } from './modules/users/ProfileService';
import { TypeOrmUserRepository } from './modules/users/TypeOrmUserRepository';
import { UserEntity } from './modules/users/user.entity';
import type { RequestHandler } from 'express';

export interface AppContainer {
  authController: AuthController;
  requireAuth: RequestHandler;
  rateLimiter: RateLimiterFactory;
  csrf: CsrfProtection;
  publicSettings: IPublicSettings;
}

/**
 * Composition root: the ONLY place that knows which concrete class implements
 * each interface. Swapping bcrypt for argon2, SMTP for an email API, JWT for
 * another token format, or memory
 * rate limits for Redis means changing one line here and nothing else.
 */
export function buildContainer(config: AppConfig, dataSource: DataSource): AppContainer {
  // ---- Infrastructure (adapters) ----
  const users = new TypeOrmUserRepository(dataSource.getRepository(UserEntity));
  const refreshTokenRepo = new TypeOrmRefreshTokenRepository(dataSource.getRepository(RefreshTokenEntity));
  const tokenRepo = new TypeOrmAuthTokenRepository(dataSource.getRepository(AuthTokenEntity));
  const settings = new ContestSettings(new TypeOrmSettingsRepository(dataSource.getRepository(SettingEntity)));
  const hasher = new BcryptPasswordHasher();
  const accessTokens = new JwtAccessTokenService(config.jwt);
  const mailer: IEmailSender =
    config.email.transport === 'smtp'
      ? new SmtpEmailSender(config.email.from, config.email)
      : new ConsoleEmailSender();
  const googleClient = config.google ? new GoogleOAuthClient(config.google) : undefined;

  // ---- Services (business rules) ----
  const composer = new AuthEmailComposer(settings, config.frontendUrl);
  const sessions = new SessionService(accessTokens, refreshTokenRepo, users, config.refreshTtlMs);
  const verification = new EmailVerificationService(users, tokenRepo, composer, mailer);
  const emailPassword = new EmailPasswordAuthService(users, hasher, settings, verification, composer, mailer);
  const passwordReset = new PasswordResetService(users, tokenRepo, hasher, sessions, composer, mailer);
  const google = new GoogleAuthService(users);
  const profiles = new ProfileService(users, settings);

  // ---- HTTP ----
  const cookies = new AuthCookies(config.cookie);
  const csrf = new CsrfProtection({ ...config.cookie, maxAgeMs: config.refreshTtlMs });
  const authController = new AuthController({
    emailPassword,
    verification,
    passwordReset,
    google,
    googleClient,
    profiles,
    sessions,
    cookies,
    csrf,
    frontendUrl: config.frontendUrl,
  });

  return {
    authController,
    requireAuth: createRequireAuth(sessions, cookies),
    rateLimiter: createRateLimiter(new MemoryRateLimitStore()),
    csrf,
    publicSettings: settings,
  };
}
