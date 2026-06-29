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
import type { AIService } from './modules/ai-balancer/domain/ports/ai-service.port.js';

console.log('[startup] Checking environment variables...');

const requiredEnvVars: Record<string, string | undefined> = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
};

for (const [name, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.warn(`[startup] ⚠ Missing env var: ${name}`);
  } else {
    console.log(`[startup] ✓ ${name} is set`);
  }
}

console.log(`[startup] PORT=${process.env.PORT ?? '3000 (default)'}`);

const services: AIService[] = [];

try {
  services.push(createGroqService(createGroqClient()));
  console.log('[startup] ✓ Groq service loaded');
} catch (err) {
  console.error('[startup] ✗ Failed to load Groq service:', (err as Error).message);
}

try {
  services.push(createOpenRouterService(createOpenRouterClient()));
  console.log('[startup] ✓ OpenRouter service loaded');
} catch (err) {
  console.error('[startup] ✗ Failed to load OpenRouter service:', (err as Error).message);
}

if (services.length === 0) {
  console.error('[startup] ✗ No AI services available. Exiting.');
  process.exit(1);
}

console.log(`[startup] ${services.length} service(s) ready: ${services.map((s) => s.name).join(', ')}`);

const balancer = new CircuitBreakerBalancer(services, {
  failureThreshold: 3,
  cooldownMs: 30 * 1000,
});

const app = buildApp({ services, balancer });
const port = Number(process.env.PORT ?? 3000);

serve({
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
});

console.log(`Server is running on http://localhost:${port}`);
