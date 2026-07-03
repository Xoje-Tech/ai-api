import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app.js';
import type { AIService } from '../modules/ai-balancer/domain/ports/ai-service.port.js';

const TEST_KEY = 'test-secret-key-1234567890abcdef';

const stubService = (name: string, content: string): AIService => ({
  name,
  chat: async () => {
    async function* gen() {
      yield content;
    }
    return gen();
  },
});

/**
 * Build an app with one stub service AND set AI_API_KEY in the env so
 * the middleware (once installed) has a real value to compare against.
 */
function makeAuthedApp() {
  process.env.AI_API_KEY = TEST_KEY;
  return buildApp({ services: [stubService('Groq', 'ok')] });
}

describe('v1-auth: bearer auth middleware', () => {
  let prevKey: string | undefined;
  beforeEach(() => {
    prevKey = process.env.AI_API_KEY;
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = prevKey;
  });

  it('1. GET /health without Authorization → 200 (exempt)', async () => {
    const app = makeAuthedApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('2. OPTIONS /v1/chat/completions without Authorization → CORS 2xx (exempt)', async () => {
    const app = makeAuthedApp();
    const res = await app.request('/v1/chat/completions', { method: 'OPTIONS' });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('3. POST /v1/chat/completions WITHOUT Authorization header → 401 with OpenAI envelope', async () => {
    const app = makeAuthedApp();
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { type: string; message: string } };
    expect(body.error.type).toBe('invalid_request_error');
    expect(typeof body.error.message).toBe('string');
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  it('4. POST /v1/chat/completions with WRONG Bearer → 401, same envelope', async () => {
    const app = makeAuthedApp();
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer wrong-key',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { type: string; message: string } };
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('5. POST /v1/chat/completions with CORRECT Bearer → 200 (request reaches handler)', async () => {
    const app = makeAuthedApp();
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(res.status).toBe(200);
  });

  it('6. 401 response body NEVER contains the AI_API_KEY value (no leakage)', async () => {
    const app = makeAuthedApp();
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    // Key value, its prefix, its suffix — none should appear anywhere.
    expect(text).not.toContain(TEST_KEY);
  });
});
