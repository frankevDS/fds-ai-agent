import { withTenantContext } from '../../config/db';
import { EnqueueOptions } from './job.types';

export class JobQueue {
  async enqueue(
    tenantId: string,
    type: string,
    payload: Record<string, unknown> = {},
    options: EnqueueOptions = {}
  ): Promise<string> {
    return withTenantContext(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO jobs (tenant_id, type, payload, run_at, max_attempts)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          tenantId,
          type,
          JSON.stringify(payload),
          options.runAt ?? new Date(),
          options.maxAttempts ?? 5,
        ]
      );
      return result.rows[0].id as string;
    });
  }
}
