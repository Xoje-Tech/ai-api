import { serve } from '@hono/node-server';
import type { AIService, ChatMessage } from './types';
import { initDB } from './db';
import { corsResponse, htmlResponse } from './utils/response';
import { landingHTML } from './views/landing';
import { handleUsers } from './routes/users';
import { createChatHandler } from './routes/chat';

console.log('[startup] Checking environment variables...');

const requiredEnvVars: Record<string, string | undefined> = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
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
  const { groqService } = await import('./services/groq');
  services.push(groqService);
  console.log('[startup] ✓ Groq service loaded');
} catch (err) {
  console.error('[startup] ✗ Failed to load Groq service:', (err as Error).message);
}

try {
  const { cerebrasService } = await import('./services/cerebras');
  services.push(cerebrasService);
  console.log('[startup] ✓ Cerebras service loaded');
} catch (err) {
  console.error('[startup] ✗ Failed to load Cerebras service:', (err as Error).message);
}

try {
  const { openrouterService } = await import('./services/openrouter');
  services.push(openrouterService);
  console.log('[startup] ✓ OpenRouter service loaded');
} catch (err) {
  console.error('[startup] ✗ Failed to load OpenRouter service:', (err as Error).message);
}

if (services.length === 0) {
  console.error('[startup] ✗ No AI services available. Exiting.');
  process.exit(1);
}

console.log(`[startup] ${services.length} service(s) ready: ${services.map(s => s.name).join(', ')}`);
let currentServiceIndex = 0;

function getNextService() {
  const service = services[currentServiceIndex]!;
  currentServiceIndex = (currentServiceIndex + 1) % services.length;
  return service;
}

await initDB();

const handleChat = createChatHandler(getNextService);

const port = Number(process.env.PORT ?? 3000);

serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === 'OPTIONS') return corsResponse();

    if (req.method === 'GET' && pathname === '/') {
      return htmlResponse(landingHTML(url.origin));
    }

    if (req.method === 'POST' && pathname === '/chat') {
      return handleChat(req);
    }

    if (pathname.startsWith('/users')) {
      const response = await handleUsers(req, url, pathname);
      if (response) return response;
    }

    return new Response("Not found", { status: 404 });
  }
});

console.log(`Server is running on http://localhost:${port}`);