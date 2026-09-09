export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  tenantId: string;
  type: string;
  payload: TPayload;
  /** Optional. If set, publishing the same (tenantId, dedupKey) twice is a no-op. */
  dedupKey?: string;
}

export type EventHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = (
  event: DomainEvent<TPayload> & { id: string; createdAt: Date }
) => Promise<void>;
