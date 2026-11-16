import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, notFound } from './common/middleware/errorHandler';
import { requireTrustedOrigin } from './common/middleware/requireTrustedOrigin';
import type { AppContainer } from './container';
import { createAuthRouter } from './modules/auth/http/auth.routes';
import { createSettingsRouter } from './modules/settings/settings.routes';

export interface AppOptions {
  frontendUrl: string;
  cookieSecret: string;
  trustProxy: number;
}

/** Builds the Express app from ready-made parts. No database or env access here, so it is easy to test. */
export function createApp(options: AppOptions, container: AppContainer): Express {
  const app = express();

  // Needed behind Render/Railway proxies so req.ip is the real visitor IP (rate limits depend on it).
  app.set('trust proxy', options.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet());
  // Only our website may call the API from a browser, with cookies.
  app.use(cors({ origin: options.frontendUrl, credentials: true }));
  // Small JSON bodies only (file uploads will get their own endpoints later).
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser(options.cookieSecret));
  // Two independent CSRF defences for every POST/PUT/PATCH/DELETE:
  // the request must come from our website (Origin) AND carry the CSRF token.
  app.use(requireTrustedOrigin(options.frontendUrl));
  app.use(container.csrf.middleware());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', createAuthRouter(container.authController, container.rateLimiter, container.requireAuth));
  app.use('/api/settings', createSettingsRouter(container.publicSettings, container.rateLimiter));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
