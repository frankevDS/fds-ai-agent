import { withTenantContext } from '../../config/db';

export async function getCurrentTenant(tenantId: string) {
  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, name, slug, status, created_at FROM tenants WHERE id = $1`,
      [tenantId]
    );
    return result.rows[0];
  });
}
