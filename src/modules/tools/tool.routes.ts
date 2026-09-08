import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { listToolsHandler, runToolHandler } from './tool.controller';

export const toolRouter = Router();
// Listing tool names/descriptions is safe for any authenticated user —
// it's a catalog, not tenant data. Running one is gated by requireAuth,
// and each tool's own execute() enforces whatever data access it needs.
toolRouter.get('/', requireAuth, listToolsHandler);
toolRouter.post('/:name/run', requireAuth, runToolHandler);
