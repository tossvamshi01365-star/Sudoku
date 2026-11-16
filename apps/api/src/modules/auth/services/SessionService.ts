import { randomUUID } from 'node:crypto';
import { AppError } from '../../../common/errors/AppError';
import { generateToken, hashToken } from '../../../common/crypto/tokens';
import type { IUserRepository } from '../../users/IUserRepository';
import type { User } from '../../users/user.types';
import type { IAccessTokenService, IRefreshTokenRepository } from '../auth.ports';

export interface IssuedTokens {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/**
 * If a refresh token is presented again within this window after it was
 * replaced, it is most likely two browser tabs refreshing at the same moment,
 * not theft. That request simply fails without logging the user out.
 */
const PARALLEL_REFRESH_GRACE_MS = 10_000;

/**
 * Login sessions made of two tokens:
 *
 *  - Access token: a JWT valid for ~12 minutes, checked on every request.
 *  - Refresh token: a random secret valid for days, used only to get a new
 *    access token. Each use REPLACES it with a new one (rotation). If an old,
 *    already-replaced token is ever used again, it was stolen: the whole login
 *    family is revoked and both the thief and the user must log in again.
 */
export class SessionService {
  constructor(
    private readonly accessTokens: IAccessTokenService,
    private readonly refreshTokens: IRefreshTokenRepository,
    private readonly users: IUserRepository,
    private readonly refreshTtlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Called after a successful login: starts a new token family. */
  start(userId: string): Promise<IssuedTokens> {
    return this.issue(userId, randomUUID());
  }

  /** Exchanges a refresh token for a fresh pair of tokens. */
  async refresh(refreshToken: string): Promise<{ user: User; tokens: IssuedTokens }> {
    const now = new Date(this.now());
    const record = await this.refreshTokens.findByTokenHash(hashToken(refreshToken));

    if (!record || record.revokedAt || record.expiresAt <= now) {
      throw AppError.unauthorized('INVALID_REFRESH_TOKEN', 'Your session has ended. Please log in again.');
    }

    if (record.replacedAt) {
      if (now.getTime() - record.replacedAt.getTime() < PARALLEL_REFRESH_GRACE_MS) {
        throw AppError.unauthorized('REFRESH_IN_PROGRESS', 'Your session was just refreshed. Please retry.');
      }
      // A replaced token used again later = stolen token. End this login everywhere.
      await this.refreshTokens.revokeFamily(record.familyId, now);
      throw AppError.unauthorized('REFRESH_TOKEN_REUSED', 'For your security, please log in again.');
    }

    if (!(await this.refreshTokens.markReplaced(record.id, now))) {
      throw AppError.unauthorized('REFRESH_IN_PROGRESS', 'Your session was just refreshed. Please retry.');
    }

    const user = await this.users.findById(record.userId);
    if (!user) throw AppError.unauthorized('INVALID_REFRESH_TOKEN', 'Your session has ended. Please log in again.');

    return { user, tokens: await this.issue(user.id, record.familyId) };
  }

  /**
   * Checks an access token and loads the user fresh from the database.
   * @returns the user, 'expired' (the client should call /refresh), or null (not logged in).
   */
  async authenticate(accessToken: string): Promise<User | 'expired' | null> {
    const claims = this.accessTokens.verify(accessToken);
    if (claims === null || claims === 'expired') return claims;

    const user = await this.users.findById(claims.sub);
    if (!user) return null;

    // Tokens issued before (or in the same second as) a password reset are no longer accepted.
    if (user.tokensValidAfter && claims.iat <= Math.floor(user.tokensValidAfter.getTime() / 1000)) return null;
    return user;
  }

  /** Logout: ends the login family that this refresh token belongs to. */
  async end(refreshToken: string): Promise<void> {
    const record = await this.refreshTokens.findByTokenHash(hashToken(refreshToken));
    if (record) await this.refreshTokens.revokeFamily(record.familyId, new Date(this.now()));
  }

  /** Logs the user out on every device and invalidates every access token issued so far. */
  async endAllForUser(userId: string): Promise<void> {
    const now = new Date(this.now());
    await this.refreshTokens.revokeAllForUser(userId, now);
    await this.users.updateCredentials(userId, { tokensValidAfter: now });
  }

  private async issue(userId: string, familyId: string): Promise<IssuedTokens> {
    const access = this.accessTokens.sign({ sub: userId, sid: familyId });
    const refreshToken = generateToken();
    const refreshExpiresAt = new Date(this.now() + this.refreshTtlMs);
    await this.refreshTokens.create({ userId, familyId, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt });
    return { accessToken: access.token, accessExpiresAt: access.expiresAt, refreshToken, refreshExpiresAt };
  }
}
