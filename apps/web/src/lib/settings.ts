import { cache } from 'react';
import { API_URL } from './config';

/**
 * Reads the public-safe contest settings (brand name, prizes, switches...)
 * from our API. Used by server components only.
 *
 * - All settings arrive in ONE request per page render (React `cache`).
 * - The response is reused for 30 seconds (Next.js fetch cache).
 * - If the API is unreachable, every setting falls back to its default.
 */
const loadPublicSettings = cache(async (): Promise<Record<string, unknown>> => {
  try {
    const res = await fetch(`${API_URL}/api/settings/public`, { next: { revalidate: 30 } });
    if (!res.ok) return {};
    const body = (await res.json()) as { settings?: unknown };
    return body.settings && typeof body.settings === 'object' ? (body.settings as Record<string, unknown>) : {};
  } catch {
    return {};
  }
});

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const settings = await loadPublicSettings();
  return key in settings ? (settings[key] as T) : defaultValue;
}

/**
 * Checks whether the 18+ age confirmation checkbox is required.
 */
export async function isAgeCheckRequired(): Promise<boolean> {
  return await getSetting<boolean>('age_check_required', true);
}

/**
 * Gets the configured brand name or placeholder.
 */
export async function getBrandName(): Promise<string> {
  return await getSetting<string>('brand_name', 'Vamshi Finance');
}
