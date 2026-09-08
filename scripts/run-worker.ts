/**
 * Standalone worker process. Run separately from the API server:
 *   npm run worker
 * Batch 1 ships one demo job type ('demo.echo'); real job types are
 * registered in src/core/container.ts as later batches add them.
 */
import dotenv from 'dotenv';
dotenv.config();

import { container } from '../src/core/container';
import { logger } from '../src/utils/logger';

const POLL_INTERVAL_MS = 2000;
let stopping = false;

async function loop() {
  while (!stopping) {
    const found = await container.jobWorker.pollOnce();
    if (!found) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

process.on('SIGINT', () => {
  logger.info('Worker shutting down...');
  stopping = true;
});

logger.info('Job worker started');
loop().catch((err) => {
  logger.error({ err }, 'Worker crashed');
  process.exit(1);
});
