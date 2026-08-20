import { loadConfig } from './config.js';
import { buildApp, createDeps } from './app.js';

const config = loadConfig();
const deps = createDeps(config);

deps.hub.startSubscriber();
await deps.storage.ensureBucket();

const app = await buildApp(deps);

const shutdown = async () => {
  await app.close();
  await deps.redis.close();
  await deps.pool.end();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try {
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`Ripple server listening on :${config.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
