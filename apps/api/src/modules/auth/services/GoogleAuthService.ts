import { AppError } from '../../../common/errors/AppError';
import { DuplicateUserError, type IUserRepository } from '../../users/IUserRepository';
import type { User } from '../../users/user.types';
import type { GoogleProfile } from '../auth.ports';

/**
 * Turns a verified Google identity into one of our accounts (the primary sign-in method).
 *
 * 1. Known Google account          -> log in.
 * 2. Email already registered      -> link Google to that account, then log in.
 * 3. New email                     -> create an account (the player picks book buyer / free player next).
 */
export class GoogleAuthService {
  constructor(private readonly users: IUserRepository) {}

  async signIn(profile: GoogleProfile): Promise<User> {
    if (!profile.emailVerified) {
      throw AppError.forbidden('GOOGLE_EMAIL_NOT_VERIFIED', 'Your Google account email is not verified.');
    }

    const byGoogleId = await this.users.findByGoogleId(profile.sub);
    if (byGoogleId) return byGoogleId;

    const byEmail = await this.users.findByEmail(profile.email);
    if (byEmail) return this.linkToExisting(byEmail, profile);

    try {
      return await this.users.create({
        email: profile.email,
        passwordHash: null,
        googleId: profile.sub,
        displayName: profile.name ? profile.name.trim().slice(0, 50) : null,
        userType: null,
        isAgeConfirmed: false,
        emailVerifiedAt: new Date(),
      });
    } catch (err) {
      if (err instanceof DuplicateUserError) {
        // A parallel request created it first; use that account.
        const created = await this.users.findByGoogleId(profile.sub);
        if (created) return created;
      }
      throw err;
    }
  }

  private async linkToExisting(user: User, profile: GoogleProfile): Promise<User> {
    if (user.googleId && user.googleId !== profile.sub) {
      throw AppError.conflict('GOOGLE_ACCOUNT_MISMATCH', 'This email is already linked to a different Google account.');
    }

    // If the existing password account was never confirmed, we cannot know who set
    // that password (someone may have registered this email before its real owner).
    // Google has now proven ownership, so that unconfirmed password is removed.
    const passwordHash = user.emailVerifiedAt ? user.passwordHash : null;
    const emailVerifiedAt = user.emailVerifiedAt ?? new Date();

    await this.users.updateCredentials(user.id, { googleId: profile.sub, passwordHash, emailVerifiedAt });
    return { ...user, googleId: profile.sub, passwordHash, emailVerifiedAt };
  }
}
