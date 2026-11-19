import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';

/**
 * For public routes that behave differently when the caller is logged in.
 * Sets req.user if a valid token is sent; otherwise the request continues as anonymous.
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice('Bearer '.length));
    } catch {
      // invalid or expired token: treat as anonymous
    }
  }
  next();
}
