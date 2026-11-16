import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Switches logins from server sessions to JWT access tokens + rotating refresh tokens,
 * and locks our auth tables away from Supabase's public REST API.
 */
export class JwtRefreshTokens1794790800000 implements MigrationInterface {
  name = 'JwtRefreshTokens1794790800000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS sessions`);

    await q.query(`
      CREATE TABLE refresh_tokens (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        family_id   uuid NOT NULL,
        token_hash  char(64) NOT NULL,
        expires_at  timestamptz NOT NULL,
        replaced_at timestamptz,
        revoked_at  timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash)
      )
    `);
    await q.query(`CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id)`);
    await q.query(`CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens (family_id)`);

    // Access tokens issued before this time are refused (set on password reset).
    await q.query(`ALTER TABLE users ADD COLUMN tokens_valid_after timestamptz`);

    // SECURITY: Supabase automatically exposes every table in the "public" schema
    // through its REST API using the public anon key. Our auth tables must never be
    // reachable that way. Row Level Security with NO policies blocks every client role;
    // this API connects as the table owner, which is not affected.
    for (const table of ['users', 'refresh_tokens', 'auth_tokens', 'migrations']) {
      await q.query(`ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY`);
    }
    // Also remove the default grants Supabase gives to its client roles.
    // (On a plain PostgreSQL server these roles do not exist, so this is skipped.)
    await q.query(`
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON TABLE users, refresh_tokens, auth_tokens FROM %I', r);
          END IF;
        END LOOP;
      END
      $$
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS tokens_valid_after`);
    await q.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await q.query(`
      CREATE TABLE sessions (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_sessions_token_hash UNIQUE (token_hash)
      )
    `);
  }
}
