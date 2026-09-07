import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { getCurrentTenantHandler } from './tenant.controller';

export const tenantRouter = Router();
tenantRouter.get('/me', requireAuth, requirePermission('tenant:read'), getCurrentTenantHandler);
