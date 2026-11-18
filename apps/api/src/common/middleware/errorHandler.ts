import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Not found.'));
};

/**
 * The single place that turns errors into responses.
 * Expected errors (AppError) show their message. Anything else is logged on the
 * server and answered with a generic message, so internals never leak.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // Errors raised by express.json(): malformed JSON or a body that is too large.
  const status = (err as { status?: number })?.status;
  if (status === 400 || status === 413) {
    res.status(status).json({
      error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON', message: 'The request body is invalid.' },
    });
    return;
  }

  console.error('[unhandled error]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
};
