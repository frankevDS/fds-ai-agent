import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthTokenPayload {
  userId: string;
  tenantId: string;
  roles: string[];
}

export function signToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    // env.jwtExpiresIn is a plain string (e.g. "8h") at runtime, which is
    // valid for jsonwebtoken, but its TS types want a narrower type than
    // `string`. This assertion is safe as long as JWT_EXPIRES_IN is set
    // to a value jsonwebtoken actually accepts (see .env.example).
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
