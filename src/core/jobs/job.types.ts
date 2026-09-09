export interface JobRecord {
  id: string;
  tenantId: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
}

export type JobHandler = (job: JobRecord) => Promise<Record<string, unknown> | void>;

export interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
}
