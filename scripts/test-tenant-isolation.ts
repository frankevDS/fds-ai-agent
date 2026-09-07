/**
 * Batch 0 verification script (Definition of Done, item 2):
 * proves that two independently-created tenants cannot see each other's
 * rows, even when both connect through the same pooled DB connection.
 *
 * Usage: npm run test:tenant-isolation
 * Requires: migrations already applied, DATABASE_URL set.
 */
import dotenv from 'dotenv';
dotenv.config();

import { pool, withTenantContext } from '../src/config/db';
import { signup } from '../src/modules/auth/auth.service';

function suffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function main() {
  const s = suffix();

  const tenantA = await signup({
    tenantName: `Test Tenant A ${s}`,
    tenantSlug: `test-tenant-a-${s}`,
    adminEmail: `admin-a-${s}@example.com`,
    adminPassword: 'correct-horse-battery-1',
  });

  const tenantB = await signup({
    tenantName: `Test Tenant B ${s}`,
    tenantSlug: `test-tenant-b-${s}`,
    adminEmail: `admin-b-${s}@example.com`,
    adminPassword: 'correct-horse-battery-2',
  });

  console.log('Created tenant A:', tenantA.tenantId);
  console.log('Created tenant B:', tenantB.tenantId);

  // Attempt, while scoped to tenant A, to read tenant B's admin user directly by ID.
  const leaked = await withTenantContext(tenantA.tenantId, async (client) => {
    const result = await client.query('SELECT id FROM users WHERE id = $1', [tenantB.userId]);
    return result.rowCount ?? 0;
  });

  // Attempt, while scoped to tenant A, to list ALL users with no tenant filter in the query itself.
  const allUsersVisibleFromA = await withTenantContext(tenantA.tenantId, async (client) => {
    const result = await client.query('SELECT id FROM users'); // deliberately no WHERE tenant_id
    return result.rows.map((r) => r.id as string);
  });

  const sawTenantBUser = allUsersVisibleFromA.includes(tenantB.userId);

  console.log('\n--- RESULTS ---');
  console.log(`Direct cross-tenant lookup returned ${leaked} row(s) (expected 0):`, leaked === 0 ? 'PASS' : 'FAIL');
  console.log(
    `Unfiltered SELECT from tenant A context saw tenant B user (expected false):`,
    !sawTenantBUser ? 'PASS' : 'FAIL'
  );

  await pool.end();

  if (leaked !== 0 || sawTenantBUser) {
    console.error('\nTENANT ISOLATION TEST FAILED');
    process.exit(1);
  }
  console.log('\nTENANT ISOLATION TEST PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
