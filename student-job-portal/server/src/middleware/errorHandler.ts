import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Express recognises an error handler by its four parameters. Do not remove `_next`.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
  const pgCode = (err as { code?: string } | null)?.code;
  if (pgCode === '23505') return res.status(409).json({ error: 'That record already exists' });
  if (pgCode === '23503') return res.status(400).json({ error: 'A referenced record does not exist' });
  if (pgCode === '23514' || pgCode === '22P02') return res.status(400).json({ error: 'Invalid value' });

  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    ...(env.NODE_ENV === 'development' && err instanceof Error ? { detail: err.message } : {}),
  });
}
