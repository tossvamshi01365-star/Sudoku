import { In, type Repository } from 'typeorm';
import type { SettingEntity } from './setting.entity';

/** Low-level read access to the settings table. */
export interface ISettingsRepository {
  getValue(key: string): Promise<unknown | undefined>;
  getValues(keys: readonly string[]): Promise<Record<string, unknown>>;
}

/**
 * The ONLY settings the public website may read. Anything not listed here
 * (future admin-only settings, for example) is never sent to a browser.
 */
export const PUBLIC_SETTING_KEYS = [
  'brand_name',
  'domain',
  'per_puzzle_prize_usd',
  'grand_prize_amount_usd',
  'grand_prize_is_placeholder',
  'free_puzzles_count',
  'contest_paused',
  'submission_deadline',
  'age_check_required',
  'accepted_proof_items',
  'accepted_proof_file_types',
  'accepted_puzzle_file_types',
  'buy_links',
] as const;

/** Read-only access to the public-safe settings, for the website. */
export interface IPublicSettings {
  getPublic(): Promise<Record<string, unknown>>;
}

/**
 * The settings the auth flows need. Kept deliberately small (Interface
 * Segregation): auth code cannot reach prize amounts or admin switches.
 */
export interface IAuthSettings {
  isAgeCheckRequired(): Promise<boolean>;
  getBrandName(): Promise<string>;
}

export class TypeOrmSettingsRepository implements ISettingsRepository {
  constructor(private readonly repo: Repository<SettingEntity>) {}

  async getValue(key: string): Promise<unknown | undefined> {
    const row = await this.repo.findOneBy({ key });
    return row?.value;
  }

  async getValues(keys: readonly string[]): Promise<Record<string, unknown>> {
    const rows = await this.repo.findBy({ key: In([...keys]) });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
}

/** Typed, defaulted access to individual settings. A missing or malformed value falls back to a safe default. */
export class ContestSettings implements IAuthSettings, IPublicSettings {
  constructor(private readonly settings: ISettingsRepository) {}

  getPublic(): Promise<Record<string, unknown>> {
    return this.settings.getValues(PUBLIC_SETTING_KEYS);
  }

  async isAgeCheckRequired(): Promise<boolean> {
    const value = await this.settings.getValue('age_check_required');
    return typeof value === 'boolean' ? value : false;
  }

  async getBrandName(): Promise<string> {
    const value = await this.settings.getValue('brand_name');
    return typeof value === 'string' && value.trim() !== '' ? value : 'Vamshi Finance';
  }
}
