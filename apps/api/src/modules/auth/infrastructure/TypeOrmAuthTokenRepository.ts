import type { Repository } from 'typeorm';
import type { AuthTokenPurpose, IAuthTokenRepository } from '../auth.ports';
import type { AuthTokenEntity } from '../entities/auth-token.entity';

export class TypeOrmAuthTokenRepository implements IAuthTokenRepository {
  constructor(private readonly repo: Repository<AuthTokenEntity>) {}

  async create(data: { userId: string; purpose: AuthTokenPurpose; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.repo.insert(data);
  }

  async consume(tokenHash: string, purpose: AuthTokenPurpose, now: Date): Promise<{ userId: string } | null> {
    // One UPDATE ... RETURNING statement: check and mark-as-used happen atomically.
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ usedAt: now })
      .where('token_hash = :tokenHash AND purpose = :purpose AND used_at IS NULL AND expires_at > :now', {
        tokenHash,
        purpose,
        now,
      })
      .returning(['user_id'])
      .execute();

    const row = (result.raw as Array<{ user_id: string }>)[0];
    return row ? { userId: row.user_id } : null;
  }

  async invalidateAllForUser(userId: string, purpose: AuthTokenPurpose, now: Date): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update()
      .set({ usedAt: now })
      .where('user_id = :userId AND purpose = :purpose AND used_at IS NULL', { userId, purpose })
      .execute();
  }
}
