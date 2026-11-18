import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/AppError';

/**
 * Checks the JSON body against a Zod schema and REPLACES req.body with the
 * cleaned result. Schemas are `.strict()`, so unexpected fields are rejected:
 * each endpoint accepts only the data it actually needs.
 */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Invalid input.';
      return next(AppError.badRequest('VALIDATION_ERROR', message));
    }
    req.body = result.data;
    next();
  };
}
