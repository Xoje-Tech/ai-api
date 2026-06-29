import { describe, it, expect, vi } from 'vitest';
import type { ChatCompletionChunk } from 'groq-sdk/resources/chat/completions.js';
import { createGroqService, type GroqClient } from './groq.adapter.js';
import type { ChatMessage } from '../../domain/ports/ai-service.port.js';

function makeChunks(items: Partial<ChatCompletionChunk>[]): AsyncIterable<ChatCompletionChunk> {
  return (async function* () {
    for (const item of items) yield item as ChatCompletionChunk;
  })();
}

function makeFakeClient(chunks: Partial<ChatCompletionChunk>[]) {
  const create = vi.fn().mockResolvedValue(makeChunks(chunks));
  const client: GroqClient = {
    chat: {
      completions: { create },
    },
  };
  return { client, create };
}

describe('groq adapter', () => {
  it('exposes an AIService named "Groq"', () => {
    const { client } = makeFakeClient([]);
    const groqService = createGroqService(client);
    expect(groqService.name).toBe('Groq');
  });

  it('forwards messages to groq and yields streamed chunks as strings', async () => {
    const { client, create } = makeFakeClient([
      { choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }] },
      { choices: [{ index: 0, delta: { content: ' from Groq' }, finish_reason: null }] },
    ]);
    const groqService = createGroqService(client);

    const messages: ChatMessage[] = [
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ];

    const stream = await groqService.chat(messages);
    const collected: string[] = [];
    for await (const chunk of stream) {
      collected.push(chunk);
    }

    expect(collected.join('')).toBe('Hello from Groq');
    expect(create).toHaveBeenCalledTimes(1);

    const callArg = create.mock.calls[0]![0];
    expect(callArg.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);
    expect(callArg.stream).toBe(true);
  });

  it('yields empty strings when a chunk has no delta content', async () => {
    const { client } = makeFakeClient([
      { choices: [{ index: 0, delta: {}, finish_reason: null }] },
      { choices: [{ index: 0, delta: { content: 'second' }, finish_reason: null }] },
    ]);
    const groqService = createGroqService(client);

    const stream = await groqService.chat([{ role: 'user', content: 'x' }]);
    const collected: string[] = [];
    for await (const chunk of stream) {
      collected.push(chunk);
    }

    expect(collected).toEqual(['', 'second']);
  });
});
