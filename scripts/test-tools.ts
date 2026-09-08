/**
 * Batch 1 verification: tool registry + orchestrator, against a real
 * Postgres. Proves (a) a real tool returns real tenant data, and
 * (b) a not-implemented stub fails loudly instead of faking a result.
 *
 * Usage: npm run test:tools
 */
import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../src/config/db';
import { container } from '../src/core/container';
import { signup } from '../src/modules/auth/auth.service';

let failures = 0;
function check(condition: boolean, label: string) {
  console.log(`${condition ? 'PASS' : 'FAIL'}: ${label}`);
  if (!condition) failures++;
}

async function main() {
  const s = Math.random().toString(36).slice(2, 8);
  const tenant = await signup({
    tenantName: `Tool Test Tenant ${s}`,
    tenantSlug: `tool-test-${s}`,
    adminEmail: `admin-${s}@example.com`,
    adminPassword: 'correct-horse-battery-5',
  });
  const ctx = { tenantId: tenant.tenantId, actingUserId: tenant.userId };

  const listed = container.orchestrator.listTools();
  check(listed.length > 20, `Tool catalog has more than 20 entries (got ${listed.length})`);
  check(
    listed.some((t) => t.name === 'get_order' && t.implemented === false),
    "'get_order' is listed and honestly marked implemented: false"
  );

  const tenantInfo = (await container.orchestrator.runTool('get_tenant_info', undefined, ctx)) as { slug: string };
  check(tenantInfo.slug === `tool-test-${s}`, 'get_tenant_info returns this tenant\'s real slug');

  let threw = false;
  let statusCode: number | undefined;
  try {
    await container.orchestrator.runTool('get_order', { orderId: 'anything' }, ctx);
  } catch (err: any) {
    threw = true;
    statusCode = err.status;
  }
  check(threw, "Calling the 'get_order' stub throws instead of returning fake data");
  check(statusCode === 501, `Stub tool error status is 501 (got ${statusCode})`);

  let searchThrew = false;
  try {
    await container.orchestrator.runTool('search_products', { query: 'laptop' }, ctx);
  } catch {
    searchThrew = true;
  }
  check(searchThrew, "search_products (real tool, no adapter connected) surfaces the adapter's 501 rather than fake products");

  const events = await pool.query(
    `SELECT count(*)::int AS n FROM events WHERE tenant_id = $1 AND type = 'tool.executed'`,
    [tenant.tenantId]
  );
  check(events.rows[0].n >= 3, `At least 3 'tool.executed' events were logged (got ${events.rows[0].n})`);

  await pool.end();
  if (failures > 0) {
    console.error(`\n${failures} TOOL TEST(S) FAILED`);
    process.exit(1);
  }
  console.log('\nALL TOOL TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
