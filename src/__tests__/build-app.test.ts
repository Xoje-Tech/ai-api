import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import type { AIService } from '../../types.js';

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

  it('returns 404 for unknown routes', async () => {
    const app = buildApp({ services: [] });
    const res = await app.request('/some/random/path');

    expect(res.status).toBe(404);
  });

  it('streams the first service response on POST /chat', async () => {
    const groqStub = stubService('Groq', 'hello from Groq');
    const cerebrasStub = stubService('Cerebras', 'hello from Cerebras');
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
    expect(body).toBe('hello from Groq');
  });
});
