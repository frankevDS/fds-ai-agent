import { withSystemContext, withTenantContext } from '../../config/db';
import { hashPassword, verifyPassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { AppError } from '../../middleware/errorHandler';

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['tenant:read', 'tenant:update', 'user:create', 'user:read', 'user:update', 'user:delete'],
  MEMBER: ['tenant:read', 'user:read'],
};

interface SignupInput {
  tenantName: string;
  tenantSlug: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName?: string;
}

/**
 * Creates a brand-new tenant plus its first (ADMIN) user. This is the
 * only place a tenant is ever created from — every tenant, including
 * Frankev's own, goes through this same path.
 */
export async function signup(input: SignupInput) {
  const { tenantName, tenantSlug, adminEmail, adminPassword, adminFullName } = input;

  if (adminPassword.length < 10) {
    throw new AppError(400, 'weak_password', 'Password must be at least 10 characters');
  }

  const passwordHash = await hashPassword(adminPassword);

  // Tenant creation itself is a system-level operation: at this point
  // there is no tenant context to scope to yet.
  return withSystemContext(async (client) => {
    const existing = await client.query('SELECT 1 FROM tenants WHERE slug = $1', [tenantSlug]);
    if ((existing.rowCount ?? 0) > 0) {
      throw new AppError(409, 'tenant_slug_taken', 'That tenant slug is already in use');
    }

    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
      [tenantName, tenantSlug]
    );
    const tenantId: string = tenantResult.rows[0].id;

    // From here on, scope every write to the new tenant explicitly via
    // set_config, even though we're still inside the system-context
    // transaction — belt-and-braces, since bypass_rls is 'on' here.
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);

    const roleIds: Record<string, string> = {};
    for (const roleName of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
      const roleResult = await client.query(
        `INSERT INTO roles (tenant_id, name) VALUES ($1, $2) RETURNING id`,
        [tenantId, roleName]
      );
      roleIds[roleName] = roleResult.rows[0].id;
    }

    for (const [roleName, permissionCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code = ANY($2::text[])`,
        [roleIds[roleName], permissionCodes]
      );
    }

    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, adminEmail.toLowerCase(), passwordHash, adminFullName ?? null]
    );
    const userId: string = userResult.rows[0].id;

    await client.query(
      `INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)`,
      [userId, roleIds.ADMIN, tenantId]
    );

    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'tenant.created', 'tenant', $4, $3)`,
      [tenantId, userId, JSON.stringify({ tenantSlug }), tenantId]
    );
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id)
       VALUES ($1, $2, 'user.created', 'user', $3)`,
      [tenantId, userId, userId]
    );

    const token = signToken({ userId, tenantId, roles: ['ADMIN'] });
    return { token, tenantId, userId };
  });
}

interface LoginInput {
  tenantSlug: string;
  email: string;
  password: string;
}

/**
 * Login inherently needs to resolve "which tenant does this slug belong
 * to" before any tenant context exists, so the tenant lookup runs under
 * withSystemContext. The password check and audit-log write then run
 * under the resolved tenant's own context.
 */
export async function login(input: LoginInput) {
  const { tenantSlug, email, password } = input;

  const tenant = await withSystemContext(async (client) => {
    const result = await client.query('SELECT id FROM tenants WHERE slug = $1 AND status = $2', [
      tenantSlug,
      'active',
    ]);
    return result.rows[0] as { id: string } | undefined;
  });

  if (!tenant) {
    throw new AppError(401, 'invalid_credentials', 'Invalid tenant, email, or password');
  }

  return withTenantContext(tenant.id, async (client) => {
    const userResult = await client.query(
      `SELECT id, password_hash FROM users WHERE tenant_id = $1 AND email = $2 AND status = 'active'`,
      [tenant.id, email.toLowerCase()]
    );
    const user = userResult.rows[0] as { id: string; password_hash: string } | undefined;

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new AppError(401, 'invalid_credentials', 'Invalid tenant, email, or password');
    }

    const roleResult = await client.query(
      `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [user.id]
    );
    const roles = roleResult.rows.map((r) => r.name as string);

    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id)
       VALUES ($1, $2, 'user.login', 'user', $3)`,
      [tenant.id, user.id, user.id]
    );

    const token = signToken({ userId: user.id, tenantId: tenant.id, roles });
    return { token, tenantId: tenant.id, userId: user.id, roles };
  });
}
