import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { listUsersHandler, createUserHandler } from './user.controller';

export const userRouter = Router();
userRouter.get('/', requireAuth, requirePermission('user:read'), listUsersHandler);
userRouter.post('/', requireAuth, requirePermission('user:create'), createUserHandler);
