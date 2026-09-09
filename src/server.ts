import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const app = createApp();

app.listen(env.port, () => {
  logger.info(`FDS AI Agent (Batch 0) listening on port ${env.port} [${env.nodeEnv}]`);
});
