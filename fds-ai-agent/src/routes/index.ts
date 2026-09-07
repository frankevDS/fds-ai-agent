import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { tenantRouter } from '../modules/tenants/tenant.routes';
import { userRouter } from '../modules/users/user.routes';
import { healthRouter } from '../modules/health/health.routes';

export const apiRouter = Router();
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/tenants', tenantRouter);
apiRouter.use('/users', userRouter);
