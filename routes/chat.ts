import type { AIService, ChatMessage } from '../types';
import { jsonResponse } from '../utils/response';

export function createChatHandler(getNextService: () => AIService) {
  return async function handleChat(req: Request): Promise<Response> {
    try {
      const { messages } = await req.json() as { messages: ChatMessage[] };
      const service = getNextService();

      console.log(`[request] Using ${service.name} service`);
      const stream = await service.chat(messages);

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
          } catch (err) {
            controller.error(err);
          } finally {
            controller.close();
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (err) {
      console.error('[request] Error processing /chat:', (err as Error).message);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  };
}
