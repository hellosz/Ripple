import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';

export function registerMetaRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/health', async () => ({
    status: 'ok' as const,
    version: deps.config.CLI_VERSION,
    sse_connections: deps.hub.connectionCount,
  }));

  app.get('/api/cli/version', async () => ({
    latest: deps.config.CLI_VERSION,
    npm_package: deps.config.CLI_NPM_PACKAGE,
    install_hint: `npm i -g ${deps.config.CLI_NPM_PACKAGE}@latest`,
  }));
}
