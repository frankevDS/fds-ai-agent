import { JobHandler } from './job.types';
import { AppError } from '../../middleware/errorHandler';

export class JobHandlerRegistry {
  private handlers = new Map<string, JobHandler>();

  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      throw new AppError(500, 'job_handler_conflict', `Job handler already registered for type '${type}'`);
    }
    this.handlers.set(type, handler);
  }

  get(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }
}
