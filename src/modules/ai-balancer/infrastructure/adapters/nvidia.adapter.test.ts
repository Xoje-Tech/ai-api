import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNvidiaService } from './nvidia.adapter.js';
import type { ChatMessage } from '../../domain/ports/ai-service.port.js';

// We mock the OpenAI client class
const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      constructor(opts: any) {
        // Record constructor args if needed
        (this as any).opts = opts;
      }
    },
  };
});

describe('nvidia adapter', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('exposes an AIService named "NVIDIA"', () => {
    const service = createNvidiaService();
    expect(service.name).toBe('NVIDIA');
  });

  it('forwards messages to NVIDIA API via OpenAI SDK and yields streamed delta content', async () => {
    // Mock the streaming response
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' from NVIDIA' } }] };
    })();
    mockCreate.mockResolvedValue(mockStream);

    const service = createNvidiaService();

    const messages: ChatMessage[] = [
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ];

    const stream = await service.chat(messages);
    const collected: string[] = [];
    for await (const chunk of stream) {
      collected.push(chunk);
    }

    expect(collected.join('')).toBe('Hello from NVIDIA');
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const req = mockCreate.mock.calls[0]![0];
    expect(req.model).toBe('meta/llama-3.1-70b-instruct');
    expect(req.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);
    expect(req.stream).toBe(true);
  });

  it('ignores empty chunks gracefully', async () => {
    const mockStream = (async function* () {
      yield { choices: [{ delta: {} }] };
      yield { choices: [{ delta: { content: 'second' } }] };
    })();
    mockCreate.mockResolvedValue(mockStream);

    const service = createNvidiaService();
    const stream = await service.chat([{ role: 'user', content: 'x' }]);
    
    const collected: string[] = [];
    for await (const chunk of stream) {
      collected.push(chunk);
    }

    expect(collected).toEqual(['', 'second']);
  });
});
