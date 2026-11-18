import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

/**
 * Reads and validates every environment variable once, at startup.
 * The app refuses to start if something required is missing, so a
 * misconfigured deployment fails loudly instead of running insecurely.
 */
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4100),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: z.enum(['true', 'false']).default('false'),
    DATABASE_SSL_CA_FILE: optionalString,
    FRONTEND_URL: z.url(),
    API_PUBLIC_URL: z.url(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().max(60).default(12),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(30).default(7),
    COOKIE_SAMESITE: z.enum(['lax', 'none']).default('lax'),
    COOKIE_DOMAIN: optionalString,
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    EMAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
    EMAIL_FROM: z.string().min(3),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z.enum(['true', 'false']).default('false'),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'SMTP_HOST is required when EMAIL_TRANSPORT=smtp' });
    }
    if (env.NODE_ENV === 'production' && env.EMAIL_TRANSPORT === 'console') {
      ctx.addIssue({ code: 'custom', path: ['EMAIL_TRANSPORT'], message: 'EMAIL_TRANSPORT=console is not allowed in production' });
    }
    if (env.JWT_SECRET === env.COOKIE_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET and COOKIE_SECRET must be different values' });
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['GOOGLE_CLIENT_ID'], message: 'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither' });
    }
  });

export interface AppConfig {
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  /** false = no SSL; otherwise SSL with certificate verification (optionally against a custom CA). */
  databaseSsl: false | { ca?: string };
  frontendUrl: string;
  apiPublicUrl: string;
  trustProxy: number;
  cookieSecret: string;
  jwt: { secret: string; ttlMs: number; issuer: string; audience: string };
  refreshTtlMs: number;
  cookie: { sameSite: 'lax' | 'none'; domain?: string; secure: boolean };
  google?: { clientId: string; clientSecret: string; redirectUri: string };
  email:
    | { transport: 'console'; from: string }
    | { transport: 'smtp'; from: string; host: string; port: number; secure: boolean; user?: string; pass?: string };
}

/** Removes a trailing slash so URL comparisons (e.g. the Origin check) are exact. */
const stripSlash = (url: string) => url.replace(/\/+$/, '');

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';
  const apiPublicUrl = stripSlash(env.API_PUBLIC_URL);

  return {
    isProduction,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    databaseSsl:
      env.DATABASE_SSL === 'true'
        ? { ca: env.DATABASE_SSL_CA_FILE ? readFileSync(env.DATABASE_SSL_CA_FILE, 'utf8') : undefined }
        : false,
    frontendUrl: stripSlash(env.FRONTEND_URL),
    apiPublicUrl,
    trustProxy: env.TRUST_PROXY,
    cookieSecret: env.COOKIE_SECRET,
    jwt: {
      secret: env.JWT_SECRET,
      ttlMs: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
      issuer: apiPublicUrl,
      audience: stripSlash(env.FRONTEND_URL),
    },
    refreshTtlMs: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    // SameSite=None cookies are only accepted by browsers when Secure is set.
    cookie: { sameSite: env.COOKIE_SAMESITE, domain: env.COOKIE_DOMAIN, secure: isProduction || env.COOKIE_SAMESITE === 'none' },
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectUri: `${apiPublicUrl}/api/auth/google/callback`,
          }
        : undefined,
    email:
      env.EMAIL_TRANSPORT === 'smtp'
        ? {
            transport: 'smtp',
            from: env.EMAIL_FROM,
            host: env.SMTP_HOST as string,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE === 'true',
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : { transport: 'console', from: env.EMAIL_FROM },
  };
}
