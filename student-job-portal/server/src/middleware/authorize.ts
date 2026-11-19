import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types/roles';
import { HttpError } from '../utils/httpError';

/**
 * Allows only the listed roles. Use after authenticate:
 *   router.post('/', authenticate, authorize('employer'), handler)
 */
export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.role)) return next(HttpError.forbidden());
    next();
  };
