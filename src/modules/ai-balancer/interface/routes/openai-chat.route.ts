import type { Balancer } from '../../application/balancer/balancer.js';
import { streamChat } from '../../application/use-cases/stream-chat.js';
import type { ChatMessage } from '../../domain/ports/ai-service.port.js';
import { jsonResponse } from '../../../shared/infrastructure/http/response.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { z } from 'zod';

/**
 * Minimal OpenAI chat-completion request schema. We only validate the
 * fields we actually use; the rest are silently ignored so future API
 * additions don't break us.
 */
const OpenAIChatRequestSchema = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .min(1)
    .max(64),
  stream: z.boolean().optional().default(false),
});

type OpenAIChatRequest = z.infer<typeof OpenAIChatRequestSchema>;

/** Maps an OpenAI message to our internal ChatMessage. */
function toChatMessage(msg: {
  role: 'user' | 'assistant' | 'system';
  content: string;
}): ChatMessage {
  return { role: msg.role, content: msg.content };
}

// ── SSE helpers ────────────────────────────────────────────────────────────

const CHAT_ID_PREFIX = 'chatcmpl-';
let _counter = 0;
function nextId(): string {
  _counter++;
  return `${CHAT_ID_PREFIX}${Date.now().toString(36)}-${_counter}`;
}

function sseData(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

const DONE_TOKEN = 'data: [DONE]\n\n';

/**
 * OpenAI-compatible streaming chunk (SSE event).
 */
function chunkEvent(
  id: string,
  model: string,
  created: number,
  index: number,
  delta: Record<string, string>,
  finishReason: string | null,
) {
  return {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index, delta, finish_reason: finishReason }],
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

/**
 * POST /v1/chat/completions — OpenAI-compatible endpoint.
 *
 * Supports both streaming (SSE) and non-streaming JSON responses.
 * Uses the same injected Balancer as the internal /chat endpoint.
 * The `model` field in the response is read from the parsed request
 * (with a fallback to 'openrouter/free' when the client omits it) —
 * see openai-route-contract §Non-Streaming Response Shape.
 */
export async function handleOpenAIChat(
  req: Request,
  balancer: Balancer,
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return openaiJsonError(400, 'invalid_request_error', 'Invalid JSON body');
  }

  const parsed = OpenAIChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return openaiJsonError(400, 'invalid_request_error', parsed.error.issues[0]?.message ?? 'Invalid request');
  }

  // Echo the client-supplied model when present; otherwise fall back to the
  // signature default. Spec: openai-route-contract "Non-Streaming Response
  // Shape" — `model` MUST echo the client value (or fall back to a known
  // string when omitted).
  const { messages, stream, model: clientModel } = parsed.data;
  const model = clientModel ?? 'openrouter/free';
  const chatMessages: ChatMessage[] = messages.map(toChatMessage);
  const created = Math.floor(Date.now() / 1000);

  if (!stream) {
    // ── Non-streaming: collect all content, return JSON ──────────────
    try {
      const it = streamChat({ balancer, messages: chatMessages });
      let content = '';
      for await (const chunk of it) {
        content += chunk;
      }

      const id = nextId();
      return new Response(
        JSON.stringify({
          id,
          object: 'chat.completion',
          created,
          model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (err: any) {
      logger.error({ err }, 'openai chat error details'); // log full error
      logger.error({ err: err.message }, 'openai chat error');
      
      // Determine if it's an upstream authentication/rate-limit error we can forward
      const status = err.status || err.statusCode || 500;
      const message = err.error?.message || err.message || 'Internal server error';
      const type = status === 401 ? 'invalid_api_key' : (status === 429 ? 'rate_limit_exceeded' : 'server_error');
      
      return openaiJsonError(status >= 400 && status < 600 ? status : 500, type, message);
    }
  }

  // ── Streaming SSE ──────────────────────────────────────────────────
  const id = nextId();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        // First chunk: emit role delta
        controller.enqueue(
          encoder.encode(
            sseData(chunkEvent(id, model, created, 0, { role: 'assistant' }, null)),
          ),
        );

        const it = streamChat({ balancer, messages: chatMessages });
        for await (const chunk of it) {
          controller.enqueue(
            encoder.encode(
              sseData(chunkEvent(id, model, created, 0, { content: chunk }, null)),
            ),
          );
        }

        // Final chunk: finish_reason = "stop"
        controller.enqueue(
          encoder.encode(
            sseData(chunkEvent(id, model, created, 0, {}, 'stop')),
          ),
        );

        controller.enqueue(encoder.encode(DONE_TOKEN));
      } catch (err: any) {
        logger.error({ err }, 'openai chat stream error details');
        logger.error({ err: err.message }, 'openai chat stream error');
        
        const status = err.status || err.statusCode || 500;
        const message = err.error?.message || err.message || 'Internal server error';
        
        controller.enqueue(
          encoder.encode(
            sseData(chunkEvent(id, model, created, 0, { content: `\n\n[Error: ${status} - ${message}]` }, 'stop')),
          ),
        );
        controller.enqueue(encoder.encode(DONE_TOKEN));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'x-vercel-ai-data-stream': 'v1',
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function openaiJsonError(
  status: number,
  type: string,
  message: string,
): Response {
  return jsonResponse({ error: { type, message } }, status);
}
