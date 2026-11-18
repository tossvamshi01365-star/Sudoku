/**
 * Contracts ("ports") the auth services depend on.
 *
 * Dependency Inversion: services like EmailPasswordAuthService only know these
 * interfaces. The real implementations (bcrypt, TypeORM, Google, SMTP) are
 * plugged in by the composition root (src/container.ts), and tests plug in
 * simple in-memory fakes instead.
 */

// ---------- Password hashing ----------

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

// ---------- Access tokens (short-lived JWT) ----------

export interface AccessTokenClaims {
  /** User ID. */
  sub: string;
  /** Login family the token belongs to (one per login, shared by its refresh tokens). */
  sid: string;
  /** Issued-at, in seconds since 1970. */
  iat: number;
}

export interface IAccessTokenService {
  sign(claims: { sub: string; sid: string }): { token: string; expiresAt: Date };
  /** Returns the claims of a valid token, 'expired' for an expired one, or null if it is invalid in any other way. */
  verify(token: string): AccessTokenClaims | 'expired' | null;
}

// ---------- Refresh tokens (long-lived, rotating, stored hashed) ----------

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  /** Set when this token was exchanged for a new one. Using it again means it was stolen. */
  replacedAt: Date | null;
  revokedAt: Date | null;
}

export interface IRefreshTokenRepository {
  create(data: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /**
   * Atomically marks a still-active token as replaced.
   * @returns false if it was already replaced or revoked (e.g. by a parallel request).
   */
  markReplaced(id: string, now: Date): Promise<boolean>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}

// ---------- One-time tokens (email verification, password reset) ----------

export type AuthTokenPurpose = 'email_verification' | 'password_reset';

export interface IAuthTokenRepository {
  create(data: { userId: string; purpose: AuthTokenPurpose; tokenHash: string; expiresAt: Date }): Promise<void>;
  /**
   * Atomically marks a valid (unused, unexpired) token as used and returns its owner.
   * A token can therefore be consumed only once, even with simultaneous requests.
   */
  consume(tokenHash: string, purpose: AuthTokenPurpose, now: Date): Promise<{ userId: string } | null>;
  /** Marks every unused token of this purpose for this user as used. */
  invalidateAllForUser(userId: string, purpose: AuthTokenPurpose, now: Date): Promise<void>;
}

// ---------- Email ----------

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface IEmailSender {
  send(message: EmailMessage): Promise<void>;
}

// ---------- Google OAuth ----------

export interface GoogleProfile {
  /** Google's stable account ID ("sub"). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleAuthorizationRequest {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface IGoogleOAuthClient {
  /** Builds the Google consent-screen URL plus the secrets needed to check the callback (state + PKCE). */
  createAuthorizationRequest(): Promise<GoogleAuthorizationRequest>;
  /** Exchanges the callback code for tokens and returns the verified identity from the ID token. */
  exchangeCode(code: string, codeVerifier: string): Promise<GoogleProfile>;
}
