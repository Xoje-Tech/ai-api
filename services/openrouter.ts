import { OpenRouter } from '@openrouter/sdk';
import type { AIService, ChatMessage } from '../types';

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const openrouterService: AIService = {
  name: 'OpenRouter',
  async chat(messages: ChatMessage[]) {
    const stream = await openrouter.chat.send({
      model: 'openrouter/free',
      messages: messages as any,
      stream: true,
    } as any);

    return (async function* () {
      for await (const chunk of stream as any) {
        yield (chunk as any).choices[0]?.delta?.content || '';
      }
    })();
  }
};
