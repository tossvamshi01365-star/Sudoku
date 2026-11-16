import { randomUUID } from 'node:crypto';
import type {
  AuthTokenPurpose,
  EmailMessage,
  GoogleAuthorizationRequest,
  GoogleProfile,
  IAuthTokenRepository,
  IEmailSender,
  IGoogleOAuthClient,
  IPasswordHasher,
  IRefreshTokenRepository,
  RefreshTokenRecord,
} from '../src/modules/auth/auth.ports';
import type { IAuthSettings, ISettingsRepository } from '../src/modules/settings/settings';
import { DuplicateUserError, type IUserRepository } from '../src/modules/users/IUserRepository';
import type { NewUser, ProfileChoice, User, UserCredentialChanges } from '../src/modules/users/user.types';

/**
 * In-memory stand-ins for the real adapters. Because services depend only on
 * interfaces, tests can run the real business logic with no database,
 * no bcrypt delay and no real email.
 */

export class InMemoryUserRepository implements IUserRepository {
  readonly rows = new Map<string, User>();

  async findById(id: string) {
    return this.copy(this.rows.get(id));
  }
  async findByEmail(email: string) {
    return this.copy([...this.rows.values()].find((u) => u.email === email));
  }
  async findByGoogleId(googleId: string) {
    return this.copy([...this.rows.values()].find((u) => u.googleId === googleId));
  }
  async create(data: NewUser) {
    const taken = [...this.rows.values()].some((u) => u.email === data.email || (data.googleId && u.googleId === data.googleId));
    if (taken) throw new DuplicateUserError();
    const now = new Date();
    const user: User = { id: randomUUID(), proofStatus: 'none', tokensValidAfter: null, createdAt: now, updatedAt: now, ...data };
    this.rows.set(user.id, user);
    return { ...user };
  }
  async updateCredentials(id: string, changes: UserCredentialChanges) {
    const user = this.rows.get(id);
    if (user) Object.assign(user, changes, { updatedAt: new Date() });
  }
  async completeProfileOnce(id: string, profile: ProfileChoice) {
    const user = this.rows.get(id);
    if (!user || user.userType !== null) return false;
    Object.assign(user, profile);
    return true;
  }
  private copy(user: User | undefined) {
    return user ? { ...user } : null;
  }
}

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  readonly rows: Array<RefreshTokenRecord & { tokenHash: string }> = [];

  async create(data: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }) {
    this.rows.push({ id: randomUUID(), replacedAt: null, revokedAt: null, ...data });
  }
  async findByTokenHash(tokenHash: string) {
    const row = this.rows.find((t) => t.tokenHash === tokenHash);
    return row ? { ...row } : null;
  }
  async markReplaced(id: string, now: Date) {
    const row = this.rows.find((t) => t.id === id && !t.replacedAt && !t.revokedAt);
    if (!row) return false;
    row.replacedAt = now;
    return true;
  }
  async revokeFamily(familyId: string, now: Date) {
    for (const t of this.rows) if (t.familyId === familyId && !t.revokedAt) t.revokedAt = now;
  }
  async revokeAllForUser(userId: string, now: Date) {
    for (const t of this.rows) if (t.userId === userId && !t.revokedAt) t.revokedAt = now;
  }
  active() {
    return this.rows.filter((t) => !t.revokedAt && !t.replacedAt);
  }
}

export class InMemoryAuthTokenRepository implements IAuthTokenRepository {
  readonly rows: Array<{ userId: string; purpose: AuthTokenPurpose; tokenHash: string; expiresAt: Date; usedAt: Date | null }> = [];

  async create(data: { userId: string; purpose: AuthTokenPurpose; tokenHash: string; expiresAt: Date }) {
    this.rows.push({ ...data, usedAt: null });
  }
  async consume(tokenHash: string, purpose: AuthTokenPurpose, now: Date) {
    const row = this.rows.find((t) => t.tokenHash === tokenHash && t.purpose === purpose && !t.usedAt && t.expiresAt > now);
    if (!row) return null;
    row.usedAt = now;
    return { userId: row.userId };
  }
  async invalidateAllForUser(userId: string, purpose: AuthTokenPurpose, now: Date) {
    for (const t of this.rows) if (t.userId === userId && t.purpose === purpose && !t.usedAt) t.usedAt = now;
  }
}

/** Not secure. Only makes hashing visible and instant in tests. */
export class FakePasswordHasher implements IPasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }
  async verify(plain: string, hash: string) {
    return hash === `hashed:${plain}`;
  }
}

export class CapturingEmailSender implements IEmailSender {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
  }
  last() {
    return this.sent[this.sent.length - 1];
  }
  /** Pulls the token out of a "#token=..." link in the last email. */
  lastToken() {
    const match = this.last()?.text.match(/#token=([A-Za-z0-9_-]+)/);
    if (!match) throw new Error('No token link in the last email');
    return match[1];
  }
}

export class InMemorySettingsRepository implements ISettingsRepository {
  constructor(readonly values: Record<string, unknown> = {}) {}
  async getValue(key: string) {
    return this.values[key];
  }
  async getValues(keys: readonly string[]) {
    return Object.fromEntries(keys.filter((k) => k in this.values).map((k) => [k, this.values[k]]));
  }
}

export class FakeSettings implements IAuthSettings {
  ageCheckRequired = false;
  async isAgeCheckRequired() {
    return this.ageCheckRequired;
  }
  async getBrandName() {
    return 'TestBrand';
  }
}

export class FakeGoogleClient implements IGoogleOAuthClient {
  profile: GoogleProfile = { sub: 'google-sub-1', email: 'gamer@example.com', emailVerified: true, name: 'Gamer' };
  lastCodeVerifier?: string;

  async createAuthorizationRequest(): Promise<GoogleAuthorizationRequest> {
    return { url: 'https://accounts.google.com/o/oauth2/v2/auth?fake=1', state: 'fake-state-value', codeVerifier: 'fake-verifier' };
  }
  async exchangeCode(code: string, codeVerifier: string) {
    if (code !== 'good-code') throw new Error('bad code');
    this.lastCodeVerifier = codeVerifier;
    return { ...this.profile };
  }
}
