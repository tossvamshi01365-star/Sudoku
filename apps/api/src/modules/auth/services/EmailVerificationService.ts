import { AppError } from '../../../common/errors/AppError';
import { generateToken, hashToken } from '../../../common/crypto/tokens';
import type { IUserRepository } from '../../users/IUserRepository';
import type { User } from '../../users/user.types';
import type { IAuthTokenRepository, IEmailSender } from '../auth.ports';
import type { AuthEmailComposer } from './AuthEmailComposer';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Sends and checks "confirm your email" links for email + password accounts. */
export class EmailVerificationService {
  constructor(
    private readonly users: IUserRepository,
    private readonly tokens: IAuthTokenRepository,
    private readonly composer: AuthEmailComposer,
    private readonly mailer: IEmailSender,
  ) {}

  async sendVerification(user: Pick<User, 'id' | 'email'>): Promise<void> {
    const now = new Date();
    // Only the newest link works; older ones are cancelled.
    await this.tokens.invalidateAllForUser(user.id, 'email_verification', now);

    const token = generateToken();
    await this.tokens.create({
      userId: user.id,
      purpose: 'email_verification',
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    });
    await this.mailer.send(await this.composer.verifyEmail(user.email, token));
  }

  /** Confirms the email that the token was sent to. */
  async verify(token: string): Promise<void> {
    const consumed = await this.tokens.consume(hashToken(token), 'email_verification', new Date());
    if (!consumed) {
      throw AppError.badRequest('INVALID_OR_EXPIRED_TOKEN', 'This confirmation link is invalid or has expired. Please request a new one.');
    }
    const user = await this.users.findById(consumed.userId);
    if (user && !user.emailVerifiedAt) {
      await this.users.updateCredentials(user.id, { emailVerifiedAt: new Date() });
    }
  }

  /**
   * Sends a fresh link. Does nothing (silently) when the email is unknown or
   * already verified, so the response never reveals which emails have accounts.
   */
  async resend(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerifiedAt) {
      await this.sendVerification(user);
    }
  }
}
