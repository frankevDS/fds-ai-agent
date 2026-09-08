import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { container } from '../../core/container';

export const listToolsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(container.orchestrator.listTools());
});

export const runToolHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError(401, 'unauthorized', 'Authentication required');
  const { name } = req.params;
  const input = req.body ?? {};
  const result = await container.orchestrator.runTool(name, input, {
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
  });
  res.json({ result });
});
