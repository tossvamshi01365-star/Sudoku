/**
 * Domain types for a player account. Services depend on these plain types,
 * never on the TypeORM entity, so the business logic does not care how
 * (or where) users are stored.
 */
export const USER_TYPES = ['book_buyer', 'free_player'] as const;
export type UserType = (typeof USER_TYPES)[number];

export type ProofStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;
  email: string;
  /** null for Google-only accounts that never set a password. */
  passwordHash: string | null;
  googleId: string | null;
  displayName: string | null;
  /** null until the player chooses "book buyer" or "free player" (Google sign-ups choose after first login). */
  userType: UserType | null;
  proofStatus: ProofStatus;
  isAgeConfirmed: boolean;
  emailVerifiedAt: Date | null;
  /**
   * Access tokens issued before this moment are rejected. Set on password reset,
   * so a stolen token stops working immediately instead of after it expires.
   */
  tokensValidAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser {
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  displayName: string | null;
  userType: UserType | null;
  isAgeConfirmed: boolean;
  emailVerifiedAt: Date | null;
}

/** Fields that the auth flows are allowed to change on an existing account. */
export type UserCredentialChanges = Partial<Pick<User, 'passwordHash' | 'googleId' | 'emailVerifiedAt' | 'tokensValidAfter'>>;

export interface ProfileChoice {
  displayName: string;
  userType: UserType;
  isAgeConfirmed: boolean;
}

/** What the API returns about the logged-in user. Never includes hashes or provider IDs. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  userType: UserType | null;
  proofStatus: ProofStatus;
  isAgeConfirmed: boolean;
  profileCompleted: boolean;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    userType: user.userType,
    proofStatus: user.proofStatus,
    isAgeConfirmed: user.isAgeConfirmed,
    profileCompleted: user.userType !== null,
  };
}
