import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

/** Validates req.body against a Zod schema and replaces it with the parsed result. */
export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error); // handled in errorHandler
    req.body = result.data;
    next();
  };
