import { AppError } from '../../../common/errors/AppError';
import { generateToken } from '../../../common/crypto/tokens';
import { DuplicateUserError, type IUserRepository } from '../../users/IUserRepository';
import type { User, UserType } from '../../users/user.types';
import type { IAuthSettings } from '../../settings/settings';
import type { IEmailSender, IPasswordHasher } from '../auth.ports';
import type { AuthEmailComposer } from './AuthEmailComposer';
import type { EmailVerificationService } from './EmailVerificationService';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  userType: UserType;
  isAgeConfirmed: boolean;
}

/** Sign-up and login with email + password (the backup to Google sign-in). */
export class EmailPasswordAuthService {
  /**
   * Hash of a random string, created once. When a login email does not exist
   * we still check the password against this, so the response takes the same
   * time either way and attackers cannot discover registered emails by timing.
   */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly settings: Pick<IAuthSettings, 'isAgeCheckRequired'>,
    private readonly verification: EmailVerificationService,
    private readonly composer: AuthEmailComposer,
    private readonly mailer: IEmailSender,
  ) {}

  /**
   * Creates an unverified account and emails a confirmation link.
   * If the email is already registered, the owner gets an email instead and
   * the caller sees the same response, so sign-up cannot be used to find out who has an account.
   */
  async register(input: RegisterInput): Promise<void> {
    if ((await this.settings.isAgeCheckRequired()) && !input.isAgeConfirmed) {
      throw AppError.badRequest('AGE_CONFIRMATION_REQUIRED', 'You must confirm that you are 18 years or older to participate.');
    }

    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      if (!existing.emailVerifiedAt) {
        // Signed up before but never confirmed: send a fresh confirmation link (the password is NOT changed).
        await this.verification.sendVerification(existing);
      } else {
        await this.mailer.send(await this.composer.accountAlreadyExists(existing.email));
      }
      return;
    }

    let user: User;
    try {
      user = await this.users.create({
        email: input.email,
        passwordHash: await this.hasher.hash(input.password),
        googleId: null,
        displayName: input.displayName,
        userType: input.userType,
        isAgeConfirmed: input.isAgeConfirmed,
        emailVerifiedAt: null,
      });
    } catch (err) {
      // Two sign-ups for the same email at the same moment: the second one is treated like "already exists".
      if (err instanceof DuplicateUserError) return;
      throw err;
    }

    await this.verification.sendVerification(user);
  }

  /** @returns the user if the email and password are correct and the email is confirmed. */
  async login(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    this.dummyHash ??= this.hasher.hash(generateToken());
    const passwordOk = await this.hasher.verify(password, user?.passwordHash ?? (await this.dummyHash));

    if (!user || !user.passwordHash || !passwordOk) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    if (!user.emailVerifiedAt) {
      throw AppError.forbidden(
        'EMAIL_NOT_VERIFIED',
        'Please confirm your email address before logging in. Check your inbox for the confirmation link.',
      );
    }
    return user;
  }
}
