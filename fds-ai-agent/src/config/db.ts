import { Pool, PoolClient } from 'pg';
import { env } from './env';

export const pool = new Pool({ connectionString: env.databaseUrl });

/**
 * Runs `fn` inside a transaction with Postgres session variables set so
 * Row-Level Security policies scope every query to `tenantId`.
 *
 * This is the ONLY sanctioned way business code should touch the
 * database — it guarantees tenant isolation at the DB layer rather than
 * relying on every query remembering to filter by tenant_id itself.
 */
export async function withTenantContext<T>(
  tenantId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (tenantId) {
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);
    }
    await client.query('SELECT set_config($1, $2, true)', ['app.bypass_rls', 'off']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Escape hatch for the small set of legitimately cross-tenant system
 * operations (e.g. looking up which tenant a login email belongs to).
 * Never expose this to a code path that also handles tenant-supplied
 * input for business data.
 */
export async function withSystemContext<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.bypass_rls', 'on']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
