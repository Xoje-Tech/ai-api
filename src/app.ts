import { Hono } from 'hono';
import type { AIService } from '../types.js';
import { corsResponse, htmlResponse } from '../utils/response.js';
import { landingHTML } from '../views/landing.js';
import { handleUsers } from '../routes/users.js';
import { createChatHandler } from '../routes/chat.js';

export interface BuildAppOptions {
  services: AIService[];
}

/**
 * buildApp returns a Hono instance configured with all the legacy routes.
 *
 * This duplicates the routing logic in index.ts verbatim — temporarily —
 * so the application becomes testable via `app.request()` without binding
 * a port. Sub-fase 2.x of the hexagonal refactor will move each layer
 * (routes, services, db) into src/modules/* and reduce this file to a
 * thin composition root.
 */
export function buildApp(options: BuildAppOptions): Hono {
  const { services } = options;
  const app = new Hono();

  let currentServiceIndex = 0;
  function getNextService(): AIService {
    if (services.length === 0) {
      throw new Error('buildApp: no services configured');
    }
    const service = services[currentServiceIndex]!;
    currentServiceIndex = (currentServiceIndex + 1) % services.length;
    return service;
  }

  const handleChat = createChatHandler(getNextService);

  // Match the legacy index.ts routing exactly. OPTIONS handled globally,
  // then a single catch-all routes by pathname prefix.
  app.all('*', async (c) => {
    if (c.req.method === 'OPTIONS') {
      return corsResponse();
    }

    const url = new URL(c.req.url);

    if (c.req.method === 'GET' && c.req.path === '/') {
      return htmlResponse(landingHTML(url.origin));
    }

    if (c.req.method === 'POST' && c.req.path === '/chat') {
      return handleChat(c.req.raw);
    }

    if (c.req.path.startsWith('/users')) {
      const response = await handleUsers(c.req.raw, url, c.req.path);
      if (response) return response;
    }

    return new Response('Not found', { status: 404 });
  });

  return app;
}
