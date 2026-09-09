import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import * as authService from './auth.service';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const signupHandler = asyncHandler(async (req: Request, res: Response) => {
  const { tenantName, tenantSlug, adminEmail, adminPassword, adminFullName } = req.body ?? {};

  if (!tenantName || !tenantSlug || !adminEmail || !adminPassword) {
    throw new AppError(
      400,
      'invalid_input',
      'tenantName, tenantSlug, adminEmail, and adminPassword are required'
    );
  }
  if (!SLUG_PATTERN.test(tenantSlug)) {
    throw new AppError(400, 'invalid_slug', 'tenantSlug must be lowercase letters, numbers, and hyphens');
  }

  const result = await authService.signup({ tenantName, tenantSlug, adminEmail, adminPassword, adminFullName });
  res.status(201).json(result);
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug, email, password } = req.body ?? {};
  if (!tenantSlug || !email || !password) {
    throw new AppError(400, 'invalid_input', 'tenantSlug, email, and password are required');
  }
  const result = await authService.login({ tenantSlug, email, password });
  res.status(200).json(result);
});
