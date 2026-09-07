import { NextFunction, Request, Response } from 'express';
import { withTenantContext } from '../config/db';
import { AppError } from './errorHandler';

/**
 * Loads the acting user's permission codes (via user_roles -> role_permissions)
 * WITHIN the tenant context set by their JWT, then requires `permissionCode`
 * to be present. This is deliberately a DB check, not something baked into
 * the JWT — permission grants can change without waiting for token expiry.
 */
export function requirePermission(permissionCode: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      throw new AppError(401, 'unauthorized', 'Authentication required');
    }
    const { userId, tenantId } = req.auth;

    const hasPermission = await withTenantContext(tenantId, async (client) => {
      const result = await client.query(
        `SELECT 1
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = $1
            AND ur.tenant_id = $2
            AND p.code = $3
          LIMIT 1`,
        [userId, tenantId, permissionCode]
      );
      return (result.rowCount ?? 0) > 0;
    });

    if (!hasPermission) {
      throw new AppError(403, 'forbidden', `Missing required permission: ${permissionCode}`);
    }
    next();
  };
}
