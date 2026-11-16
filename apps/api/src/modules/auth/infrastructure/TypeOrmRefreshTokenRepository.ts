import { IsNull, type Repository } from 'typeorm';
import type { IRefreshTokenRepository, RefreshTokenRecord } from '../auth.ports';
import type { RefreshTokenEntity } from '../entities/refresh-token.entity';

export class TypeOrmRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly repo: Repository<RefreshTokenEntity>) {}

  async create(data: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.repo.insert(data);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.repo.findOneBy({ tokenHash });
    return row
      ? { id: row.id, userId: row.userId, familyId: row.familyId, expiresAt: row.expiresAt, replacedAt: row.replacedAt, revokedAt: row.revokedAt }
      : null;
  }

  async markReplaced(id: string, now: Date): Promise<boolean> {
    // The WHERE clause makes this a compare-and-set: only one request can win.
    const result = await this.repo.update({ id, replacedAt: IsNull(), revokedAt: IsNull() }, { replacedAt: now });
    return (result.affected ?? 0) > 0;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.repo.update({ familyId, revokedAt: IsNull() }, { revokedAt: now });
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.repo.update({ userId, revokedAt: IsNull() }, { revokedAt: now });
  }
}
