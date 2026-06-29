import type { AIService, ChatMessage } from '@ai-balancer/domain/ports/ai-service.port.js';

export interface StreamChatDeps {
  balancer: {
    selectService(): AIService;
    recordSuccess(name: string): void;
    recordFailure(name: string): void;
  };
  messages: ChatMessage[];
  maxAttempts?: number;
}

export async function* streamChat(deps: StreamChatDeps): AsyncIterable<string> {
  const { balancer, messages, maxAttempts = 3 } = deps;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const service = balancer.selectService();
    let stream: AsyncIterable<string>;
    try {
      stream = await service.chat(messages);
    } catch (err) {
      balancer.recordFailure(service.name);
      lastError = err;
      continue;
    }
    balancer.recordSuccess(service.name);
    yield* stream;
    return;
  }
  throw lastError ?? new Error('All services failed');
}
