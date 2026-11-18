import type { User } from '../modules/users/user.types';

declare global {
  namespace Express {
    interface Request {
      /** Set by the requireAuth middleware for logged-in requests. */
      user?: User;
    }
  }
}

export {};
