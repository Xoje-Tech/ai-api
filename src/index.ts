import { serve } from '@hono/node-server';

import { buildApp } from './app.js';
import { CircuitBreakerBalancer } from './modules/ai-balancer/application/balancer/circuit-breaker-balancer.js';
import { logger } from './modules/shared/infrastructure/logger/logger.js';
import { loadAvailableProviders } from './modules/ai-balancer/infrastructure/provider.registry.js';

const defaultPort = process.env.NODE_ENV === 'production' ? 6789 : 5678;
logger.info({ port: process.env.PORT ?? defaultPort }, 'PORT configuration');

const services = loadAvailableProviders();

if (services.length === 0) {
  logger.fatal('No AI services available — exiting');
  process.exit(1);
}

if (!process.env.AI_API_KEY) {
  logger.fatal(
    { envVar: 'AI_API_KEY' },
    'AI_API_KEY is required to serve /v1/* routes — exiting',
  );
  process.exit(1);
}

logger.info(
  { count: services.length, services: services.map((s) => s.name) },
  'services ready',
);

const balancer = new CircuitBreakerBalancer(services, {
  failureThreshold: 3,
  cooldownMs: 30 * 1000,
});

const app = buildApp({ services, balancer });
const port = Number(process.env.PORT ?? defaultPort);

// Per api-runtime spec: loopback-by-default. Non-loopback bind requires
// AI_API_ALLOW_PUBLIC=true (explicit operator override).
const host = process.env.AI_API_HOST ?? '127.0.0.1';
if (
  host !== '127.0.0.1' &&
  host !== '::1' &&
  process.env.AI_API_ALLOW_PUBLIC !== 'true'
) {
  logger.fatal(
    { host },
    'AI_API_HOST points at a non-loopback address — set AI_API_ALLOW_PUBLIC=true to override',
  );
  process.exit(1);
}

serve({
  port,
  hostname: host,
  fetch: app.fetch,
});

logger.info({ url: `http://${host}:${port}` }, 'server running');
