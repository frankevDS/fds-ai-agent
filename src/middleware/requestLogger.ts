import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

export const requestLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    tenantId: (req as any).auth?.tenantId ?? null,
    userId: (req as any).auth?.userId ?? null,
  }),
});
