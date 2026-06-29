import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import type { AIService } from '../modules/ai-balancer/domain/ports/ai-service.port.js';

const stubService = (name: string, content: string): AIService => ({
  name,
  chat: async () => {
    async function* gen() {
      yield content;
    }
    return gen();
  },
});

async function readStreamBody(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe('buildApp (legacy behaviour)', () => {
  it('serves the landing page at GET /', async () => {
    const app = buildApp({ services: [] });
    const res = await app.request('/');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('Bun AI API');
  });

  it('returns CORS headers on OPTIONS preflight', async () => {
    const app = buildApp({ services: [] });
    const res = await app.request('/', { method: 'OPTIONS' });

    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('responds 404 for unknown routes', async () => {
    const app = buildApp({ services: [] });
    const res = await app.request('/some/random/path');

    expect(res.status).toBe(404);
  });

  it('responds to GET /health with a service status report', async () => {
    const groq = stubService('Groq', 'ok');
    const openrouter = stubService('OpenRouter', 'ok');
    const app = buildApp({ services: [groq, openrouter] });

    const res = await app.request('/health');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { status: string; services: { name: string }[]; timestamp: string };
    expect(body.status).toBe('ok');
    expect(body.services.map((s) => s.name)).toEqual(['Groq', 'OpenRouter']);
    expect(typeof body.timestamp).toBe('string');
    // ISO 8601 sanity check
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('streams the first service response on POST /chat', async () => {
    const groqStub = stubService('Groq', 'Hello from Groq');
    const cerebrasStub = stubService('Cerebras', 'Hello from Cerebras');
    const app = buildApp({ services: [groqStub, cerebrasStub] });

    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const body = await readStreamBody(res);
    expect(body).toBe('Hello from Groq');
  });

  it('returns 400 with Zod issues when /chat body is invalid', async () => {
    const app = buildApp({ services: [stubService('Groq', 'x')] });
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe('Invalid request');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('returns 400 with plain text when /chat body is not JSON', async () => {
    const app = buildApp({ services: [stubService('Groq', 'x')] });
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid JSON body');
  });
});
