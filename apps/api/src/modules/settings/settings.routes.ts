import { Router } from 'express';
import { byIp, type RateLimiterFactory } from '../../common/rate-limit/rateLimit';
import type { IPublicSettings } from './settings';

/**
 * GET /api/settings/public: brand name, prize amounts, switches... for the website.
 * Only whitelisted keys are returned (see PUBLIC_SETTING_KEYS).
 */
export function createSettingsRouter(settings: IPublicSettings, limit: RateLimiterFactory): Router {
  const router = Router();

  router.get(
    '/public',
    limit({ name: 'settings:ip', max: 120, windowMs: 60 * 1000, key: byIp, message: 'Too many requests. Please slow down.' }),
    async (_req, res) => {
      // Browsers and the website's server may reuse this for 30 seconds.
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json({ settings: await settings.getPublic() });
    },
  );

  return router;
}
