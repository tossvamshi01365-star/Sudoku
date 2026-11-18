import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AuthTokenEntity } from '../modules/auth/entities/auth-token.entity';
import { RefreshTokenEntity } from '../modules/auth/entities/refresh-token.entity';
import { SettingEntity } from '../modules/settings/setting.entity';
import { UserEntity } from '../modules/users/user.entity';
import { CreateAuthTables1794787200000 } from './migrations/1794787200000-CreateAuthTables';
import { JwtRefreshTokens1794790800000 } from './migrations/1794790800000-JwtRefreshTokens';

/**
 * PostgreSQL connection. `synchronize` is OFF: the schema only changes through
 * reviewed migration files, never automatically from the entity classes.
 */
export function createDataSource(options: { url: string; ssl: false | { ca?: string } }): DataSource {
  return new DataSource({
    type: 'postgres',
    url: options.url,
    // The server certificate is always verified. Supabase needs its CA file (DATABASE_SSL_CA_FILE).
    ssl: options.ssl ? { rejectUnauthorized: true, ca: options.ssl.ca } : false,
    entities: [UserEntity, RefreshTokenEntity, AuthTokenEntity, SettingEntity],
    migrations: [CreateAuthTables1794787200000, JwtRefreshTokens1794790800000],
    synchronize: false,
    logging: ['error'],
  });
}
