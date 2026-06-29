import type { Balancer } from '../../application/balancer/balancer.js';
import { streamChat } from '../../application/use-cases/stream-chat.js';
import type { ChatMessage } from '../../domain/ports/ai-service.port.js';
import { jsonResponse } from '@shared/infrastructure/http/response.js';

/**
 * HTTP handler for POST /chat. Decodes the request body, invokes the
 * streamChat use-case with the injected balancer, and returns the
 * resulting string stream as an SSE-flavored ReadableStream response.
 *
 * The use-case owns the failover policy (round-robin, circuit-breaker,
 * retry, etc.), so this handler is a thin HTTP adapter — no business
 * logic lives here.
 */
export async function handleChat(req: Request, balancer: Balancer): Promise<Response> {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };

    const stream = streamChat({ balancer, messages });

    const readable = new ReadableStream<Uint8Array>({
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
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[chat] Error processing /chat:', (err as Error).message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
