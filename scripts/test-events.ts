/**
 * Batch 1 verification: EventBus persistence, idempotency, and
 * in-process subscriber delivery, against a real Postgres.
 *
 * Usage: npm run test:events
 */
import dotenv from 'dotenv';
dotenv.config();

import { pool, withTenantContext } from '../src/config/db';
import { EventBus } from '../src/core/events/eventBus';
import { signup } from '../src/modules/auth/auth.service';

let failures = 0;
function check(condition: boolean, label: string) {
  console.log(`${condition ? 'PASS' : 'FAIL'}: ${label}`);
  if (!condition) failures++;
}

async function main() {
  const s = Math.random().toString(36).slice(2, 8);
  const tenant = await signup({
    tenantName: `Event Test Tenant ${s}`,
    tenantSlug: `event-test-${s}`,
    adminEmail: `admin-${s}@example.com`,
    adminPassword: 'correct-horse-battery-3',
  });

  const bus = new EventBus();
  let subscriberCallCount = 0;
  let lastPayload: unknown = null;
  bus.subscribe('demo.test_event', async (event) => {
    subscriberCallCount++;
    lastPayload = event.payload;
  });

  const first = await bus.publish({
    tenantId: tenant.tenantId,
    type: 'demo.test_event',
    payload: { hello: 'world' },
    dedupKey: 'only-once',
  });
  check(first.deduped === false, 'First publish is not marked as deduped');

  const second = await bus.publish({
    tenantId: tenant.tenantId,
    type: 'demo.test_event',
    payload: { hello: 'world-again' },
    dedupKey: 'only-once',
  });
  check(second.deduped === true, 'Second publish with the same dedupKey is deduped');
  check(second.id === first.id, 'Deduped publish returns the original event id');

  check(subscriberCallCount === 1, `Subscriber was called exactly once (got ${subscriberCallCount})`);
  check(
    JSON.stringify(lastPayload) === JSON.stringify({ hello: 'world' }),
    'Subscriber received the original (non-deduped) payload'
  );

  // RLS is enforced on `events`, so a raw pool.query() here (no tenant
  // context set) would correctly see zero rows regardless of what was
  // inserted — this must go through withTenantContext like any other
  // tenant-scoped read, exactly as production code is required to.
  const n = await withTenantContext(tenant.tenantId, async (client) => {
    const result = await client.query('SELECT count(*)::int AS n FROM events WHERE tenant_id = $1', [
      tenant.tenantId,
    ]);
    return result.rows[0].n as number;
  });
  check(n === 1, `Exactly one event row persisted for this tenant (got ${n})`);

  await pool.end();
  if (failures > 0) {
    console.error(`\n${failures} EVENT TEST(S) FAILED`);
    process.exit(1);
  }
  console.log('\nALL EVENT TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
