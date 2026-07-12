import OpenAI from 'openai';
import type { AIService, ChatMessage } from '../../domain/ports/ai-service.port.js';

export function createNvidiaService(): AIService {
  // The SDK takes the API key from process.env.NVIDIA_API_KEY by default
  // But since the OpenAI constructor defaults to process.env.OPENAI_API_KEY,
  // we must pass it explicitly.
  const client = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY || '',
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  return {
    name: 'NVIDIA',
    models: [
      'meta/llama-3.1-70b-instruct',
    ],
    async chat(messages: ChatMessage[], options?: { modelId: string }): Promise<AsyncIterable<string>> {
      const stream = await client.chat.completions.create({
        model: options?.modelId || 'meta/llama-3.1-70b-instruct', // fallback default, will be overridden or used
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      });

      return (async function* () {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content ?? '';
          yield content;
        }
      })();
    },
  };
}
