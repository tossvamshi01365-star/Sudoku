import jwt from 'jsonwebtoken';
import type { AccessTokenClaims, IAccessTokenService } from '../auth.ports';

export interface JwtOptions {
  secret: string;
  ttlMs: number;
  issuer: string;
  audience: string;
  /** Clock in milliseconds. Injectable so tests can move time forward. */
  now?: () => number;
}

/**
 * Signs and checks the short-lived access token (a JWT, HS256).
 * Only HS256 is accepted when verifying, so a token claiming "alg: none" or
 * another algorithm is always refused.
 */
export class JwtAccessTokenService implements IAccessTokenService {
  private readonly now: () => number;

  constructor(private readonly options: JwtOptions) {
    if (options.secret.length < 32) throw new Error('JWT secret must be at least 32 characters');
    this.now = options.now ?? Date.now;
  }

  sign(claims: { sub: string; sid: string }): { token: string; expiresAt: Date } {
    const iat = Math.floor(this.now() / 1000);
    const exp = iat + Math.floor(this.options.ttlMs / 1000);
    const token = jwt.sign(
      { sub: claims.sub, sid: claims.sid, typ: 'access', iat, exp },
      this.options.secret,
      { algorithm: 'HS256', issuer: this.options.issuer, audience: this.options.audience },
    );
    return { token, expiresAt: new Date(exp * 1000) };
  }

  verify(token: string): AccessTokenClaims | 'expired' | null {
    try {
      const payload = jwt.verify(token, this.options.secret, {
        algorithms: ['HS256'],
        issuer: this.options.issuer,
        audience: this.options.audience,
        clockTimestamp: Math.floor(this.now() / 1000),
      });
      if (typeof payload === 'string') return null;
      const { sub, sid, iat, typ } = payload as Record<string, unknown>;
      if (typ !== 'access' || typeof sub !== 'string' || typeof sid !== 'string' || typeof iat !== 'number') return null;
      return { sub, sid, iat };
    } catch (err) {
      return err instanceof jwt.TokenExpiredError ? 'expired' : null;
    }
  }
}
