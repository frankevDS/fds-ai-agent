import { PoolClient } from 'pg';
import { withTenantContext } from '../../config/db';
import { logger } from '../../utils/logger';
import { DomainEvent, EventHandler } from './event.types';

/**
 * Minimal event bus for Batch 1: persists every event to the `events`
 * table (the durable source of truth / audit trail) and then invokes
 * any in-process subscribers for that event type.
 *
 * KNOWN LIMITATION (documented, not hidden): if the caller passes its
 * own `client` mid-transaction and that transaction later rolls back,
 * subscribers will already have fired for an event that never actually
 * committed. This is acceptable for Batch 1's in-process subscribers
 * (nothing external happens yet) but must be revisited — e.g. with a
 * transactional outbox — before Batch 7's automation engine wires
 * external side effects (emails, webhooks) to events.
 */
export class EventBus {
  private subscribers = new Map<string, EventHandler[]>();

  subscribe<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    type: string,
    handler: EventHandler<TPayload>
  ): void {
    const list = this.subscribers.get(type) ?? [];
    list.push(handler as EventHandler);
    this.subscribers.set(type, list);
  }

  async publish<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    event: DomainEvent<TPayload>,
    existingClient?: PoolClient
  ): Promise<{ id: string; createdAt: Date; deduped: boolean }> {
    const insert = async (client: PoolClient) => {
      if (event.dedupKey) {
        const existing = await client.query(
          `SELECT id, created_at FROM events WHERE tenant_id = $1 AND dedup_key = $2`,
          [event.tenantId, event.dedupKey]
        );
        if ((existing.rowCount ?? 0) > 0) {
          return { id: existing.rows[0].id, createdAt: existing.rows[0].created_at, deduped: true };
        }
      }
      const result = await client.query(
        `INSERT INTO events (tenant_id, type, payload, dedup_key)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [event.tenantId, event.type, JSON.stringify(event.payload ?? {}), event.dedupKey ?? null]
      );
      return { id: result.rows[0].id, createdAt: result.rows[0].created_at, deduped: false };
    };

    const outcome = existingClient
      ? await insert(existingClient)
      : await withTenantContext(event.tenantId, insert);

    if (!outcome.deduped) {
      await this.notifySubscribers<TPayload>({ ...event, id: outcome.id, createdAt: outcome.createdAt });
    }
    return outcome;
  }

  private async notifySubscribers<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    event: DomainEvent<TPayload> & { id: string; createdAt: Date }
  ): Promise<void> {
    const handlers = this.subscribers.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await (handler as EventHandler<TPayload>)(event);
      } catch (err) {
        // One subscriber failing must never break the publish call or
        // block other subscribers — it's logged, not swallowed silently.
        logger.error({ err, eventType: event.type, eventId: event.id }, 'Event subscriber failed');
      }
    }
  }
}
