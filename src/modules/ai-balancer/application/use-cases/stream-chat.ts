import type { AIService, ChatMessage } from '@ai-balancer/domain/ports/ai-service.port.js';

export interface StreamChatDeps {
  balancer: {
    selectService(): AIService;
    selectServiceForContext?(estimatedTokens: number): { service: AIService; modelId: string } | null;
    recordSuccess(name: string): void;
    recordFailure(name: string): void;
  };
  messages: ChatMessage[];
  maxAttempts?: number;
}

export async function* streamChat(deps: StreamChatDeps): AsyncIterable<string> {
  const { balancer, messages, maxAttempts = 3 } = deps;
  let lastError: unknown;
  const estimatedTokens = Math.ceil(JSON.stringify(messages).length / 4);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let service: AIService;
    let modelId: string | undefined;

    if (balancer.selectServiceForContext) {
      const selected = balancer.selectServiceForContext(estimatedTokens);
      if (!selected) {
        throw new Error('No service available for the requested context length');
      }
      service = selected.service;
      modelId = selected.modelId;
    } else {
      service = balancer.selectService();
    }

    let stream: AsyncIterable<string>;
    try {
      stream = await service.chat(messages, modelId ? { modelId } : undefined);
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
