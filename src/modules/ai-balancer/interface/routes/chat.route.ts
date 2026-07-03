import type { Balancer } from '../../application/balancer/balancer.js';
import { streamChat } from '../../application/use-cases/stream-chat.js';
import type { ChatMessage } from '../../domain/ports/ai-service.port.js';
import { jsonResponse } from '../../../shared/infrastructure/http/response.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { ChatRequestSchema } from '../dto/chat-request.dto.js';

/**
 * HTTP handler for POST /chat. Validates the request body with the
 * Zod ChatRequestSchema, invokes the streamChat use-case with the
 * injected balancer, and wraps the resulting AsyncIterable<string>
 * as a text/event-stream response.
 *
 * The use-case owns failover policy (round-robin, breaker, retry).
 * This handler is a thin HTTP adapter — no business logic here.
 */
export async function handleChat(req: Request, balancer: Balancer): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Invalid request', issues: parsed.error.issues },
      400,
    );
  }

  const messages: ChatMessage[] = parsed.data.messages;

  try {
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
    logger.error({ err: (err as Error).message }, 'chat route error');
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
