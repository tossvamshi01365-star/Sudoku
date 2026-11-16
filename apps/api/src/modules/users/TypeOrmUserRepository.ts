import { QueryFailedError, type Repository } from 'typeorm';
import { DuplicateUserError, type IUserRepository } from './IUserRepository';
import type { UserEntity } from './user.entity';
import type { NewUser, ProfileChoice, User, UserCredentialChanges } from './user.types';

/** Postgres error code for "unique constraint violated". */
const UNIQUE_VIOLATION = '23505';

export class TypeOrmUserRepository implements IUserRepository {
  constructor(private readonly repo: Repository<UserEntity>) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.repo.findOneBy({ googleId });
  }

  async create(data: NewUser): Promise<User> {
    try {
      return await this.repo.save(this.repo.create(data));
    } catch (err) {
      if (err instanceof QueryFailedError && (err.driverError as { code?: string })?.code === UNIQUE_VIOLATION) {
        throw new DuplicateUserError();
      }
      throw err;
    }
  }

  async updateCredentials(id: string, changes: UserCredentialChanges): Promise<void> {
    await this.repo.update({ id }, changes);
  }

  async completeProfileOnce(id: string, profile: ProfileChoice): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ displayName: profile.displayName, userType: profile.userType, isAgeConfirmed: profile.isAgeConfirmed })
      .where('id = :id AND user_type IS NULL', { id })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
