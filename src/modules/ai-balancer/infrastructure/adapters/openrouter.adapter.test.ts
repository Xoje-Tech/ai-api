import { describe, it, expect, vi } from 'vitest';
import type { ChatStreamingResponseChunk } from '@openrouter/sdk/models/chatstreamingresponsechunk.js';
import { createOpenRouterService, type OpenRouterClient } from './openrouter.adapter.js';
import type { ChatMessage } from '../../domain/ports/ai-service.port.js';

function makeChunks(items: Partial<ChatStreamingResponseChunk>[]): AsyncIterable<ChatStreamingResponseChunk> {
  return (async function* () {
    for (const item of items) yield item as ChatStreamingResponseChunk;
  })();
}

function makeFakeClient(chunks: Partial<ChatStreamingResponseChunk>[]) {
  const send = vi.fn().mockResolvedValue(makeChunks(chunks));
  const client: OpenRouterClient = {
    chat: { send },
  };
  return { client, send };
}

describe('openrouter adapter', () => {
  it('exposes an AIService named "OpenRouter"', () => {
    const { client } = makeFakeClient([]);
    const orService = createOpenRouterService(client);
    expect(orService.name).toBe('OpenRouter');
  });

  it('forwards messages to openrouter and yields streamed delta content as strings', async () => {
    const { client, send } = makeFakeClient([
      { choices: [{ index: 0, delta: { content: 'Hello' } }] },
      { choices: [{ index: 0, delta: { content: ' from OpenRouter' } }] },
    ]);
    const orService = createOpenRouterService(client);

    const messages: ChatMessage[] = [
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hi back' },
    ];

    const stream = await orService.chat(messages);
    const collected: string[] = [];
    for await (const chunk of stream) {
      collected.push(chunk);
    }

    expect(collected.join('')).toBe('Hello from OpenRouter');
    expect(send).toHaveBeenCalledTimes(1);

    const req = send.mock.calls[0]![0];
    expect(req.chatGenerationParams.model).toBe('openrouter/free');
    expect(req.chatGenerationParams.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hi back' },
    ]);
    expect(req.chatGenerationParams.stream).toBe(true);
  });

  it('yields empty strings when a chunk delta has no content', async () => {
    const { client } = makeFakeClient([
      { choices: [{ index: 0, delta: {} }] },
      { choices: [{ index: 0, delta: { content: 'second' } }] },
    ]);
    const orService = createOpenRouterService(client);

    const stream = await orService.chat([{ role: 'user', content: 'x' }]);
    const collected: string[] = [];
    for await (const chunk of stream) {
      collected.push(chunk);
    }

    expect(collected).toEqual(['', 'second']);
  });
});
