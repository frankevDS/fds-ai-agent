import { withSystemContext } from '../../config/db';
import { logger } from '../../utils/logger';
import { JobHandlerRegistry } from './jobHandlerRegistry';
import { JobRecord } from './job.types';

const BACKOFF_BASE_MS = 5000;

/**
 * Polls the `jobs` table across ALL tenants (a genuinely cross-tenant
 * infrastructure operation, hence withSystemContext) using
 * `FOR UPDATE SKIP LOCKED` so multiple worker processes can run
 * concurrently without ever double-processing the same job.
 */
export class JobWorker {
  constructor(private registry: JobHandlerRegistry, private workerId: string = 'worker-1') {}

  /** Processes at most one due job. Returns true if a job was found (whether it succeeded or failed). */
  async pollOnce(): Promise<boolean> {
    const claimed = await withSystemContext(async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id, type, payload, attempts, max_attempts
           FROM jobs
          WHERE status = 'pending' AND run_at <= now()
          ORDER BY run_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1`
      );
      if (result.rowCount === 0) return null;

      const row = result.rows[0];
      await client.query(
        `UPDATE jobs SET status = 'processing', locked_at = now(), locked_by = $2, updated_at = now()
          WHERE id = $1`,
        [row.id, this.workerId]
      );

      const job: JobRecord = {
        id: row.id,
        tenantId: row.tenant_id,
        type: row.type,
        payload: row.payload,
        status: 'processing',
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
      };
      return job;
    });

    if (!claimed) return false;

    const handler = this.registry.get(claimed.type);
    if (!handler) {
      await this.markFailed(claimed, `No job handler registered for type '${claimed.type}'`);
      return true;
    }

    try {
      const result = await handler(claimed);
      await withSystemContext((client) =>
        client.query(
          `UPDATE jobs SET status = 'completed', result = $2, updated_at = now() WHERE id = $1`,
          [claimed.id, JSON.stringify(result ?? {})]
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, jobId: claimed.id, jobType: claimed.type }, 'Job handler threw');
      await this.markFailed(claimed, message);
    }
    return true;
  }

  private async markFailed(job: JobRecord, errorMessage: string): Promise<void> {
    const attempts = job.attempts + 1;
    const exhausted = attempts >= job.maxAttempts;
    const nextRunAt = new Date(Date.now() + BACKOFF_BASE_MS * attempts);

    await withSystemContext((client) =>
      client.query(
        `UPDATE jobs
            SET status = $2,
                attempts = $3,
                last_error = $4,
                run_at = $5,
                updated_at = now()
          WHERE id = $1`,
        [job.id, exhausted ? 'failed' : 'pending', attempts, errorMessage, nextRunAt]
      )
    );
  }

  /** Runs pollOnce in a loop until no due job is found. Useful for tests and manual runs. */
  async drain(maxIterations = 100): Promise<number> {
    let processed = 0;
    for (let i = 0; i < maxIterations; i++) {
      const found = await this.pollOnce();
      if (!found) break;
      processed++;
    }
    return processed;
  }
}
