import { TokenPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware. */
      user?: TokenPayload;
    }
  }
}

export {};
