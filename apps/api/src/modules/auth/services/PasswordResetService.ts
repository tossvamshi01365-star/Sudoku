import { AppError } from '../../../common/errors/AppError';
import { generateToken, hashToken } from '../../../common/crypto/tokens';
import type { IUserRepository } from '../../users/IUserRepository';
import type { IAuthTokenRepository, IEmailSender, IPasswordHasher } from '../auth.ports';
import type { AuthEmailComposer } from './AuthEmailComposer';
import type { SessionService } from './SessionService';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** "Forgot password" flow: email a one-time link, then set a new password with it. */
export class PasswordResetService {
  constructor(
    private readonly users: IUserRepository,
    private readonly tokens: IAuthTokenRepository,
    private readonly hasher: IPasswordHasher,
    private readonly sessions: SessionService,
    private readonly composer: AuthEmailComposer,
    private readonly mailer: IEmailSender,
  ) {}

  /** Always "succeeds" from the caller's view, so the response never reveals whether the email has an account. */
  async requestReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const now = new Date();
    await this.tokens.invalidateAllForUser(user.id, 'password_reset', now);
    const token = generateToken();
    await this.tokens.create({
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
    });
    await this.mailer.send(await this.composer.resetPassword(user.email, token));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const now = new Date();
    const consumed = await this.tokens.consume(hashToken(token), 'password_reset', now);
    if (!consumed) {
      throw AppError.badRequest('INVALID_OR_EXPIRED_TOKEN', 'This reset link is invalid or has expired. Please request a new one.');
    }
    const user = await this.users.findById(consumed.userId);
    if (!user) {
      throw AppError.badRequest('INVALID_OR_EXPIRED_TOKEN', 'This reset link is invalid or has expired. Please request a new one.');
    }

    await this.users.updateCredentials(user.id, {
      passwordHash: await this.hasher.hash(newPassword),
      // Opening the emailed link proves the user owns this address.
      emailVerifiedAt: user.emailVerifiedAt ?? now,
    });
    // Anyone who was logged in with the old password is logged out everywhere,
    // and access tokens already handed out stop working immediately.
    await this.sessions.endAllForUser(user.id);
  }
}
