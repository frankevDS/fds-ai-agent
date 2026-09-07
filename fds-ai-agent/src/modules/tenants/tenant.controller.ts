import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import * as tenantService from './tenant.service';

export const getCurrentTenantHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Authentication required');
  const tenant = await tenantService.getCurrentTenant(req.auth.tenantId);
  res.json(tenant);
});
