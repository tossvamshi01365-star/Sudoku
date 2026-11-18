import type { NewUser, ProfileChoice, User, UserCredentialChanges } from './user.types';

/** Thrown by a repository when a unique field (email or Google ID) is already taken. */
export class DuplicateUserError extends Error {
  constructor() {
    super('A user with this email or Google account already exists');
    this.name = 'DuplicateUserError';
  }
}

/** Storage contract for user accounts. Implemented by TypeORM in production and by an in-memory fake in tests. */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  /** `email` must already be normalized (trimmed, lower-case). */
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  /** @throws DuplicateUserError if the email or Google ID is already used. */
  create(data: NewUser): Promise<User>;
  updateCredentials(id: string, changes: UserCredentialChanges): Promise<void>;
  /**
   * Saves the profile choice only if the user has not chosen a type yet.
   * Done in one atomic step so the type can never be changed afterwards.
   * @returns true if saved, false if the profile was already completed.
   */
  completeProfileOnce(id: string, profile: ProfileChoice): Promise<boolean>;
}
