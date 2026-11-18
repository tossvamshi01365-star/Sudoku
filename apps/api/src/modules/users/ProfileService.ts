import { AppError } from '../../common/errors/AppError';
import type { IAuthSettings } from '../settings/settings';
import type { IUserRepository } from './IUserRepository';
import type { ProfileChoice, User } from './user.types';

/**
 * Google sign-ups arrive without a player type. They choose it once here;
 * after that the choice is permanently locked.
 */
export class ProfileService {
  constructor(
    private readonly users: IUserRepository,
    private readonly settings: Pick<IAuthSettings, 'isAgeCheckRequired'>,
  ) {}

  async completeProfile(userId: string, choice: ProfileChoice): Promise<User> {
    if ((await this.settings.isAgeCheckRequired()) && !choice.isAgeConfirmed) {
      throw AppError.badRequest('AGE_CONFIRMATION_REQUIRED', 'You must confirm that you are 18 years or older to participate.');
    }

    const saved = await this.users.completeProfileOnce(userId, choice);
    if (!saved) {
      throw AppError.conflict('PROFILE_ALREADY_COMPLETED', 'Your profile is already complete and the player type cannot be changed.');
    }

    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized('NOT_AUTHENTICATED', 'Please log in.');
    return user;
  }
}
