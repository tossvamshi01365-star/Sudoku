import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tables for the sign-up / login feature: users, sessions, one-time auth tokens
 * and the editable settings table (with its starting values).
 * Tables for proofs, puzzles and submissions are added by their own features later.
 */
export class CreateAuthTables1794787200000 implements MigrationInterface {
  name = 'CreateAuthTables1794787200000';

  public async up(q: QueryRunner): Promise<void> {
    // gen_random_uuid() is built into PostgreSQL 13+.
    await q.query(`
      CREATE TABLE users (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email             varchar(254) NOT NULL,
        password_hash     varchar(255),
        google_id         varchar(255),
        display_name      varchar(50),
        user_type         varchar(20),
        proof_status      varchar(20) NOT NULL DEFAULT 'none',
        is_age_confirmed  boolean NOT NULL DEFAULT false,
        email_verified_at timestamptz,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT uq_users_google_id UNIQUE (google_id),
        CONSTRAINT chk_users_email_lowercase CHECK (email = lower(email)),
        CONSTRAINT chk_users_user_type CHECK (user_type IS NULL OR user_type IN ('book_buyer', 'free_player')),
        CONSTRAINT chk_users_proof_status CHECK (proof_status IN ('none', 'pending', 'verified', 'rejected')),
        CONSTRAINT chk_users_has_login_method CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
      )
    `);

    // Safety net in the database itself: once a player type is chosen it can never change.
    await q.query(`
      CREATE FUNCTION lock_user_type() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.user_type IS NOT NULL AND NEW.user_type IS DISTINCT FROM OLD.user_type THEN
          RAISE EXCEPTION 'user_type is locked once chosen';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await q.query(`
      CREATE TRIGGER trg_users_lock_user_type
      BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION lock_user_type()
    `);

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
    await q.query(`CREATE INDEX idx_sessions_user_id ON sessions (user_id)`);
    await q.query(`CREATE INDEX idx_sessions_expires_at ON sessions (expires_at)`);

    await q.query(`
      CREATE TABLE auth_tokens (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose    varchar(30) NOT NULL,
        token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at    timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_auth_tokens_token_hash UNIQUE (token_hash),
        CONSTRAINT chk_auth_tokens_purpose CHECK (purpose IN ('email_verification', 'password_reset'))
      )
    `);
    await q.query(`CREATE INDEX idx_auth_tokens_user_purpose ON auth_tokens (user_id, purpose)`);

    // IF NOT EXISTS: a Supabase project created from supabase/migrations already has this table.
    await q.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key         varchar(100) PRIMARY KEY,
        value       jsonb NOT NULL,
        description text,
        updated_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Starting values (same as the earlier supabase/seed.sql). The owner edits them later.
    await q.query(`
      INSERT INTO settings (key, value, description) VALUES
        ('brand_name', '"Vamshi Finance"', 'Official display name of the contest website'),
        ('domain', '"DOMAIN"', 'Primary domain of the website'),
        ('per_puzzle_prize_usd', '1000', 'Prize amount in USD for each puzzle (verified book buyers only)'),
        ('grand_prize_amount_usd', '1000000000', 'Official grand prize amount in USD'),
        ('grand_prize_is_placeholder', 'false', 'Whether the public site shows the grand prize as to be announced'),
        ('free_puzzles_count', '5', 'Number of puzzles open to free players (puzzles 1 to N)'),
        ('contest_paused', 'false', 'Global switch to pause the contest during security maintenance'),
        ('submission_deadline', '"2027-12-31T23:59:59Z"', 'ISO-8601 UTC deadline for submitting solutions'),
        ('age_check_required', 'false', 'Whether the 18+ checkbox is required at sign-up (anyone can play; age is verified at prize claim)'),
        ('accepted_proof_items', '["order_id", "order_screenshot", "book_photo_with_username"]', 'Proof items required from book buyers'),
        ('accepted_proof_file_types', '["image/jpeg", "image/png", "application/pdf"]', 'MIME types allowed for proof of purchase'),
        ('accepted_puzzle_file_types', '["image/jpeg", "image/png"]', 'MIME types allowed for the photo of a finished puzzle'),
        ('buy_links', '{"US": "https://www.amazon.com", "IN": "https://www.amazon.in", "UK": "https://www.amazon.co.uk", "GLOBAL": "https://www.amazon.com"}', 'Official bookstore links by country code')
      ON CONFLICT (key) DO NOTHING
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS settings`);
    await q.query(`DROP TABLE IF EXISTS auth_tokens`);
    await q.query(`DROP TABLE IF EXISTS sessions`);
    await q.query(`DROP TRIGGER IF EXISTS trg_users_lock_user_type ON users`);
    await q.query(`DROP FUNCTION IF EXISTS lock_user_type()`);
    await q.query(`DROP TABLE IF EXISTS users`);
  }
}
