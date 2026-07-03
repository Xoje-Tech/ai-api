import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app.js';
import type { AIService } from '../modules/ai-balancer/domain/ports/ai-service.port.js';

const TEST_BEARER = 'test-key-1234567890abcdef';

const stubService = (name: string, content: string): AIService => ({
  name,
  chat: async () => {
    async function* gen() {
      yield content;
    }
    return gen();
  },
});

describe('openai-route-contract: GET /v1/models', () => {
  let prevKey: string | undefined;
  beforeEach(() => {
    prevKey = process.env.AI_API_KEY;
    process.env.AI_API_KEY = TEST_BEARER;
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = prevKey;
  });

  it('returns object:"list" with one entry per loaded adapter', async () => {
    const groq = stubService('Groq', 'ok');
    const openrouter = stubService('OpenRouter', 'ok');
    const app = buildApp({ services: [groq, openrouter] });

    const res = await app.request('/v1/models', {
      headers: { authorization: `Bearer ${TEST_BEARER}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as {
      object: string;
      data: { id: string; object: string; owned_by: string }[];
    };
    expect(body.object).toBe('list');
    const ids = body.data.map((m) => m.id).sort();
    expect(ids).toEqual(['groq', 'openrouter']);
    for (const m of body.data) {
      expect(m.object).toBe('model');
      expect(m.owned_by).toBe('ai-api');
    }
  });

  // /v1/models is auth-gated by v1-auth spec (path not in the exempt list).
  // The full Bearer enforcement matrix (no Bearer, wrong Bearer) is exercised
  // by the broader auth-middleware.test.ts using /v1/chat/completions.
  // This test confirms the exempted /health and the gate on /v1/models
  // diverge correctly: /v1/models WITHOUT a Bearer returns 401.
  it('returns 401 without Bearer (auth-gated per v1-auth)', async () => {
    const groq = stubService('Groq', 'ok');
    const app = buildApp({ services: [groq] });
    const res = await app.request('/v1/models');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { type: string; message: string } };
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.message).toMatch(/missing or invalid/i);
  });
});
