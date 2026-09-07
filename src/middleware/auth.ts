import { NextFunction, Request, Response } from 'express';
import { verifyToken, AuthTokenPayload } from '../utils/jwt';
import { AppError } from './errorHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

/**
 * Verifies the JWT and attaches { userId, tenantId, roles } to req.auth.
 * Does NOT touch the database — role/permission checks that need fresh
 * data happen in requirePermission below.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'unauthorized', 'Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length);
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    throw new AppError(401, 'unauthorized', 'Invalid or expired token');
  }
}
