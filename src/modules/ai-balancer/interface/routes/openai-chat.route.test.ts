import { describe, it, expect } from 'vitest';
import {
  handleOpenAIChat,
} from './openai-chat.route.js';
import type { Balancer } from '../../application/balancer/balancer.js';
import type { AIService } from '../../domain/ports/ai-service.port.js';

const stubService = (name: string, content: string): AIService => ({
  name,
  chat: async () => {
    async function* gen() {
      yield content;
    }
    return gen();
  },
});

const stubBalancer = (services: AIService[]): Balancer => {
  let i = 0;
  return {
    selectService() {
      const s = services[i++ % services.length];
      if (!s) throw new Error('no services');
      return s;
    },
    recordSuccess() {
      // no-op for stubs
    },
    recordFailure() {
      // no-op for stubs
    },
  };
};

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

const groq = stubService('Groq', 'hello-from-groq');

describe('openai-route-contract: POST /v1/chat/completions', () => {
  it('1. non-streaming JSON echoes client-supplied model', async () => {
    const balancer = stubBalancer([groq]);
    const req = new Request('http://test/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      }),
    });
    const res = await handleOpenAIChat(req, balancer);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as {
      object: string;
      model: string;
      choices: { message: { role: string; content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
    expect(body.object).toBe('chat.completion');
    expect(body.model).toBe('llama-3.1-8b'); // echoes client value, NOT hardcoded 'openrouter/free'
    expect(body.choices[0]?.message.role).toBe('assistant');
    expect(typeof body.choices[0]?.message.content).toBe('string');
    expect(body.usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  });

  it('2. streaming SSE terminates with `data: [DONE]\\n\\n`', async () => {
    const balancer = stubBalancer([groq]);
    const req = new Request('http://test/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    });
    const res = await handleOpenAIChat(req, balancer);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const body = await readStreamBody(res);
    expect(body).toMatch(/data: \[DONE\]\n\n$/);
  });

  it('3. empty messages → 400 invalid_request_error', async () => {
    const balancer = stubBalancer([groq]);
    const req = new Request('http://test/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        stream: false,
      }),
    });
    const res = await handleOpenAIChat(req, balancer);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { type: string } };
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('4. 65 messages (over max) → 400 invalid_request_error', async () => {
    const balancer = stubBalancer([groq]);
    const messages = Array.from({ length: 65 }, () => ({ role: 'user', content: 'x' }));
    const req = new Request('http://test/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages,
        stream: false,
      }),
    });
    const res = await handleOpenAIChat(req, balancer);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { type: string } };
    expect(body.error.type).toBe('invalid_request_error');
  });

  // Spec: openai-route-contract §"Chat-Only Surface" → "Tools silently dropped".
  // Locks Zod's default-strip-unknown-keys behavior so future schema edits
  // (e.g. someone adds `.strict()`) surface as a failing test.
  it('5. tools/functions/tool_choice are silently dropped (no 400)', async () => {
    const balancer = stubBalancer([groq]);
    const req = new Request('http://test/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{ type: 'function', function: { name: 'foo' } }],
        functions: [{ name: 'bar' }],
        tool_choice: 'auto',
      }),
    });
    const res = await handleOpenAIChat(req, balancer);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      model: string;
    };
    expect(body.object).toBe('chat.completion');
    expect(body.model).toBe('llama-3.1-8b');
  });
});
