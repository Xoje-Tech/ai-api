import { serve } from '@hono/node-server';

import { buildApp } from './app.js';
import { CircuitBreakerBalancer } from './modules/ai-balancer/application/balancer/circuit-breaker-balancer.js';
import {
  createGroqClient,
  createGroqService,
} from './modules/ai-balancer/infrastructure/adapters/groq.adapter.js';
import {
  createOpenRouterClient,
  createOpenRouterService,
} from './modules/ai-balancer/infrastructure/adapters/openrouter.adapter.js';
import { createNvidiaService } from './modules/ai-balancer/infrastructure/adapters/nvidia.adapter.js';
import type { AIService } from './modules/ai-balancer/domain/ports/ai-service.port.js';
import { logger } from './modules/shared/infrastructure/logger/logger.js';

logger.info('Checking environment variables...');

const requiredEnvVars: Record<string, string | undefined> = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
};

for (const [name, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    logger.warn({ envVar: name }, 'missing env var');
  } else {
    logger.info({ envVar: name }, 'env var set');
  }
}

logger.info({ port: process.env.PORT ?? '3000' }, 'PORT configuration');

const services: AIService[] = [];

try {
  services.push(createGroqService(createGroqClient()));
  logger.info('Groq service loaded');
} catch (err) {
  logger.error({ err: (err as Error).message }, 'Failed to load Groq service');
}

try {
  services.push(createOpenRouterService(createOpenRouterClient()));
  logger.info('OpenRouter service loaded');
} catch (err) {
  logger.error(
    { err: (err as Error).message },
    'Failed to load OpenRouter service',
  );
}

try {
  services.push(createNvidiaService());
  logger.info('NVIDIA service loaded');
} catch (err) {
  logger.error(
    { err: (err as Error).message },
    'Failed to load NVIDIA service',
  );
}

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
const port = Number(process.env.PORT ?? 3000);

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
