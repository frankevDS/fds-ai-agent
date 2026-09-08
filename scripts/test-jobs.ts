/**
 * Batch 1 verification: job enqueue + SKIP LOCKED worker processing,
 * against a real Postgres.
 *
 * Usage: npm run test:jobs
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
    tenantName: `Job Test Tenant ${s}`,
    tenantSlug: `job-test-${s}`,
    adminEmail: `admin-${s}@example.com`,
    adminPassword: 'correct-horse-battery-4',
  });

  const jobId = await container.jobQueue.enqueue(tenant.tenantId, 'demo.echo', { message: 'hi' });

  const processedCount = await container.jobWorker.drain();
  check(processedCount === 1, `Worker drained exactly one due job (got ${processedCount})`);

  const row = await pool.query('SELECT status, result, attempts FROM jobs WHERE id = $1', [jobId]);
  check(row.rows[0].status === 'completed', `Job status is 'completed' (got '${row.rows[0].status}')`);
  check(
    JSON.stringify(row.rows[0].result) === JSON.stringify({ echoed: { message: 'hi' } }),
    'Job result matches the demo.echo handler output'
  );

  // Unknown job type should be marked failed, not silently dropped or crash the worker.
  const badJobId = await container.jobQueue.enqueue(tenant.tenantId, 'no.such.handler', {}, { maxAttempts: 1 });
  await container.jobWorker.drain();
  const badRow = await pool.query('SELECT status, last_error FROM jobs WHERE id = $1', [badJobId]);
  check(badRow.rows[0].status === 'failed', `Unknown-type job ends up 'failed' (got '${badRow.rows[0].status}')`);
  check(!!badRow.rows[0].last_error, 'Unknown-type job records an error message');

  await pool.end();
  if (failures > 0) {
    console.error(`\n${failures} JOB TEST(S) FAILED`);
    process.exit(1);
  }
  console.log('\nALL JOB TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
