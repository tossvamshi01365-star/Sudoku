/**
 * Public URL of our Express API (apps/api). Used by the browser and by the
 * website's server. Set NEXT_PUBLIC_API_URL in .env.local.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100').replace(/\/+$/, '');
