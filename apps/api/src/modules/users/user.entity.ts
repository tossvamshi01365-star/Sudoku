import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ProofStatus, User, UserType } from './user.types';

/**
 * TypeORM mapping for the `users` table. The table itself (constraints,
 * checks, indexes) is defined in the migrations; `synchronize` is off.
 * Every column states its type explicitly so the mapping does not depend
 * on decorator metadata emitted by the compiler.
 */
@Entity({ name: 'users' })
export class UserEntity implements User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ name: 'google_id', type: 'varchar', length: 255, nullable: true })
  googleId: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 50, nullable: true })
  displayName: string | null;

  @Column({ name: 'user_type', type: 'varchar', length: 20, nullable: true })
  userType: UserType | null;

  @Column({ name: 'proof_status', type: 'varchar', length: 20, default: 'none' })
  proofStatus: ProofStatus;

  @Column({ name: 'is_age_confirmed', type: 'boolean', default: false })
  isAgeConfirmed: boolean;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'tokens_valid_after', type: 'timestamptz', nullable: true })
  tokensValidAfter: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
