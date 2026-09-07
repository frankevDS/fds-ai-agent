import { withTenantContext } from '../../config/db';
import { hashPassword } from '../../utils/password';
import { AppError } from '../../middleware/errorHandler';

export async function listUsers(tenantId: string) {
  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, email, full_name, status, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId]
    );
    return result.rows;
  });
}

interface CreateUserInput {
  tenantId: string;
  actingUserId: string;
  email: string;
  password: string;
  fullName?: string;
  role: 'ADMIN' | 'MEMBER';
}

export async function createUser(input: CreateUserInput) {
  const { tenantId, actingUserId, email, password, fullName, role } = input;

  if (password.length < 10) {
    throw new AppError(400, 'weak_password', 'Password must be at least 10 characters');
  }

  return withTenantContext(tenantId, async (client) => {
    const existing = await client.query(
      `SELECT 1 FROM users WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email.toLowerCase()]
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new AppError(409, 'email_taken', 'A user with that email already exists in this tenant');
    }

    const roleResult = await client.query(`SELECT id FROM roles WHERE tenant_id = $1 AND name = $2`, [
      tenantId,
      role,
    ]);
    if ((roleResult.rowCount ?? 0) === 0) {
      throw new AppError(400, 'invalid_role', `Role '${role}' does not exist for this tenant`);
    }
    const roleId = roleResult.rows[0].id;

    const passwordHash = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, status, created_at`,
      [tenantId, email.toLowerCase(), passwordHash, fullName ?? null]
    );
    const user = userResult.rows[0];

    await client.query(`INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)`, [
      user.id,
      roleId,
      tenantId,
    ]);

    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'user.created', 'user', $3, $4)`,
      [tenantId, actingUserId, user.id, JSON.stringify({ role })]
    );

    return user;
  });
}
