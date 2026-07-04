import { Groq } from 'groq-sdk';
import type {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
} from 'groq-sdk/resources/chat/completions.js';
import type { AIService, ChatMessage } from '../../domain/ports/ai-service.port.js';

/**
 * The subset of the Groq SDK that this adapter needs. Defined here so
 * tests can inject a fake without depending on the real SDK paths.
 */
export interface GroqClient {
  chat: {
    completions: {
      create: (params: {
        messages: ChatCompletionMessageParam[];
        model: string;
        stream: true;
        temperature?: number;
        max_completion_tokens?: number;
        top_p?: number;
        stop?: string | null;
      }) => Promise<AsyncIterable<ChatCompletionChunk>>;
    };
  };
}

function toGroqMessage(msg: ChatMessage): ChatCompletionMessageParam {
  return { role: msg.role, content: msg.content };
}

const MODEL_KIMI = 'moonshotai/kimi-k2-instruct-0905';
const TEMP = 0.6;
const TOKENS_LIMIT = 1024 * 4;
const TOP_P = 1;

/**
 * Builds an AIService adapter backed by a Groq client.
 */
export function createGroqService(client: GroqClient): AIService {
  return {
    name: 'Groq',
    async chat(messages: ChatMessage[], options?: { modelId: string }) {
      const stream = await client.chat.completions.create({
        messages: messages.map(toGroqMessage),
        model: options?.modelId || MODEL_KIMI,
        stream: true,
        temperature: TEMP,
        max_completion_tokens: TOKENS_LIMIT,
        top_p: TOP_P,
        stop: null,
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
 * Constructs the real Groq client. The cast is intentional and narrow:
 * the SDK exposes three overloads of `completions.create`; we only use
 * the streaming one.
 */
export function createGroqClient(): GroqClient {
  return new Groq() as unknown as GroqClient;
}
