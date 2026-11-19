import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { verifyToken } from '../utils/jwt';

/** Requires a valid "Authorization: Bearer <token>" header and sets req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(HttpError.unauthorized());
  }

  try {
    req.user = verifyToken(header.slice('Bearer '.length));
    next();
  } catch {
    next(HttpError.unauthorized('Invalid or expired token'));
  }
}
