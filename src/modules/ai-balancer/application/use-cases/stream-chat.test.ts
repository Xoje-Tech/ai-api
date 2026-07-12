import { describe, it, expect } from 'vitest';
import { RoundRobinBalancer } from '@ai-balancer/application/balancer/round-robin-balancer.js';
import { streamChat } from '@ai-balancer/application/use-cases/stream-chat.js';
import type { AIService, ChatMessage } from '@ai-balancer/domain/ports/ai-service.port.js';

const stubService = (name: string, chunks: string[] = []): AIService => ({
  name, models: [],
  chat: async () => {
    async function* gen() {
      for (const c of chunks) yield c;
    }
    return gen();
  },
});

describe('streamChat', () => {
  it('yields chunks from the selected service', async () => {
    const services = [stubService('A', ['hello', ' world'])];
    const balancer = new RoundRobinBalancer(services);
    const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

    const result: string[] = [];
    for await (const chunk of streamChat({ balancer, messages })) {
      result.push(chunk);
    }

    expect(result.join('')).toBe('hello world');
  });

  it('falls back to the next service when the first throws', async () => {
    const throwing: AIService = {
      name: 'flaky', models: [],
      chat: async () => {
        throw new Error('boom');
      },
    };
    const stable = stubService('stable', ['recovered']);
    const balancer = new RoundRobinBalancer([throwing, stable]);
    const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

    const result: string[] = [];
    for await (const chunk of streamChat({ balancer, messages })) {
      result.push(chunk);
    }

    expect(result.join('')).toBe('recovered');
  });

  it('throws when every service in the balancer fails', async () => {
    const services: AIService[] = [
      {
        name: 'A', models: [],
        chat: async () => {
          throw new Error('A failed');
        },
      },
      {
        name: 'B', models: [],
        chat: async () => {
          throw new Error('B failed');
        },
      },
    ];
    const balancer = new RoundRobinBalancer(services);
    const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

    await expect(async () => {
      for await (const _chunk of streamChat({ balancer, messages, maxAttempts: 2 })) {
        // consume
      }
    }).rejects.toThrow();
  });
});
