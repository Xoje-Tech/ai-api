import { serve } from '@hono/node-server';

import { buildApp } from './app.js';
import { CircuitBreakerBalancer } from './modules/ai-balancer/application/balancer/circuit-breaker-balancer.js';
import { logger } from './modules/shared/infrastructure/logger/logger.js';
import { loadAvailableProviders } from './modules/ai-balancer/infrastructure/provider.registry.js';
import { parseEnv } from './modules/shared/infrastructure/env.config.js';

// 1. Validate environment
const config = parseEnv(process.env);
logger.info({ port: config.PORT }, 'PORT configuration');

// 2. Load providers
const services = loadAvailableProviders();

if (services.length === 0) {
  logger.fatal('No AI services available — exiting');
  process.exit(1);
}

logger.info(
  { count: services.length, services: services.map((s) => s.name) },
  'services ready',
);

// 3. Setup balancer and app
const balancer = new CircuitBreakerBalancer(services, {
  failureThreshold: config.CIRCUIT_BREAKER_FAILURES,
  cooldownMs: config.CIRCUIT_BREAKER_COOLDOWN_MS,
});

const app = buildApp({ services, balancer });

// 4. Start server
serve({
  port: config.PORT,
  hostname: config.AI_API_HOST,
  fetch: app.fetch,
});

logger.info({ url: `http://${config.AI_API_HOST}:${config.PORT}` }, 'server running');
