import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import * as userService from './user.service';

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Authentication required');
  const users = await userService.listUsers(req.auth.tenantId);
  res.json(users);
});

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Authentication required');
  const { email, password, fullName, role } = req.body ?? {};
  if (!email || !password || !role) {
    throw new AppError(400, 'invalid_input', 'email, password, and role are required');
  }
  if (role !== 'ADMIN' && role !== 'MEMBER') {
    throw new AppError(400, 'invalid_role', "role must be 'ADMIN' or 'MEMBER'");
  }

  const user = await userService.createUser({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    email,
    password,
    fullName,
    role,
  });
  res.status(201).json(user);
});
