import { OpenRouter } from '@openrouter/sdk';
import type { ChatStreamingResponseChunk } from '@openrouter/sdk/models/chatstreamingresponsechunk.js';
import type { Message } from '@openrouter/sdk/models/message.js';
import type { AIService, ChatMessage } from '../../domain/ports/ai-service.port.js';

/**
 * Subset of the OpenRouter SDK that this adapter needs. Tests pass a
 * stub that satisfies this interface; production code uses
 * createOpenRouterClient() to wrap a real instance.
 */
export interface OpenRouterClient {
  chat: {
    send: (request: {
      chatGenerationParams: {
        model: string;
        messages: Message[];
        stream: true;
      };
    }) => Promise<AsyncIterable<ChatStreamingResponseChunk>>;
  };
}

/**
 * Translates our domain ChatMessage (a simple 3-role model) into the
 * OpenRouter Message union. The SDK accepts each role as a structurally
 * compatible object literal so we can return a discriminated value.
 */
function toOpenRouterMessage(msg: ChatMessage): Message {
  switch (msg.role) {
    case 'user':
      return { role: 'user', content: msg.content };
    case 'assistant':
      return { role: 'assistant', content: msg.content };
    case 'system':
      return { role: 'system', content: msg.content };
  }
}

const MODEL_FREE = 'openrouter/free';

/**
 * Builds an AIService adapter backed by an OpenRouter client.
 */
export function createOpenRouterService(client: OpenRouterClient): AIService {
  return {
    name: 'OpenRouter',
    models: [
      'meta-llama/llama-3-8b-instruct:free',
      'google/gemma-7b-it:free',
      'mistralai/mistral-7b-instruct:free',
    ],
    async chat(messages: ChatMessage[]) {
      const stream = await client.chat.send({
        chatGenerationParams: {
          model: MODEL_FREE,
          messages: messages.map(toOpenRouterMessage),
          stream: true,
        },
      });
      return (async function* () {
        for await (const chunk of stream) {
          yield chunk.choices[0]?.delta?.content ?? '';
        }
      })();
    },
  };
}

/**
 * Constructs the real OpenRouter client. The cast is intentional and
 * narrow: the SDK exposes several overloads of `chat.send` that return
 * either a Promise<ChatResponse> or a Promise<EventStream<...>>; we
 * only use the streaming variant, and the literal `stream: true` in
 * createOpenRouterService narrows the overload on the call site.
 */
export function createOpenRouterClient(): OpenRouterClient {
  return new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  }) as unknown as OpenRouterClient;
}
