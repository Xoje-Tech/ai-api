import { z } from 'zod';

/**
 * Schema for POST /chat request body.
 *
 * Validated at the HTTP boundary (in the route handler) so the
 * streamChat use-case only ever receives safe, typed input.
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(32_000),
});

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(64),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatMessageDto = z.infer<typeof ChatMessageSchema>;
