import { Hono } from 'hono';
import type { AIService } from '../types.js';
import { RoundRobinBalancer } from './modules/ai-balancer/application/balancer/round-robin-balancer.js';
import type { Balancer } from './modules/ai-balancer/application/balancer/balancer.js';
import { handleChat } from './modules/ai-balancer/interface/routes/chat.route.js';
import { handleUsers } from './modules/users/interface/routes/users.route.js';
import type { UserRepository } from './modules/users/domain/ports/user-repository.port.js';
import { InMemoryUserRepository } from './modules/users/infrastructure/persistence/in-memory-user.repository.js';
import { corsResponse, htmlResponse, jsonResponse } from '@shared/infrastructure/http/response.js';
import { landingHTML } from '@shared/interface/views/landing.js';

export interface BuildAppOptions {
  services: AIService[];
  /**
   * Optional balancer strategy. Defaults to RoundRobinBalancer so the
   * legacy /chat round-robin behaviour is preserved when callers
   * don't pass one. Pass a CircuitBreakerBalancer to opt in to
   * failover + breaker semantics — see src/modules/ai-balancer/
   * application/balancer/circuit-breaker-balancer.ts.
   */
  balancer?: Balancer;
  /**
   * Optional UserRepository. Defaults to InMemoryUserRepository so the
   * /users CRUD is exercisable without Postgres. Production wiring
   * passes a PostgresUserRepository.
   */
  userRepository?: UserRepository;
}

/**
 * buildApp returns a Hono instance configured with all routes.
 *
 * - /chat uses the streamChat use-case with an injected Balancer.
 * - /users uses the hexagonal users module with an injected repo.
 * - /health reports the loaded services.
 */
export function buildApp(options: BuildAppOptions): Hono {
  const { services, balancer: providedBalancer, userRepository } = options;
  const balancer: Balancer = providedBalancer ?? new RoundRobinBalancer(services);
  const userRepo: UserRepository = userRepository ?? new InMemoryUserRepository();
  const app = new Hono();

  app.all('*', async (c) => {
    if (c.req.method === 'OPTIONS') {
      return corsResponse();
    }

    const url = new URL(c.req.url);

    if (c.req.method === 'GET' && c.req.path === '/') {
      return htmlResponse(landingHTML(url.origin));
    }

    if (c.req.method === 'GET' && c.req.path === '/health') {
      return jsonResponse({
        status: 'ok',
        services: services.map((s) => ({ name: s.name })),
        timestamp: new Date().toISOString(),
      });
    }

    if (c.req.method === 'POST' && c.req.path === '/chat') {
      return handleChat(c.req.raw, balancer);
    }

    if (c.req.path.startsWith('/users')) {
      const response = await handleUsers(c.req.raw, url, c.req.path, userRepo);
      if (response) return response;
    }

    return new Response('Not found', { status: 404 });
  });

  return app;
}
