import { describe, it, expect } from 'vitest';
import { ChatRequestSchema, ChatMessageSchema } from './chat-request.dto.js';

describe('chat request DTO', () => {
  it('accepts a single user message', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a multi-message conversation across all three roles', () => {
    const result = ChatRequestSchema.safeParse({
      messages: [
        { role: 'system', content: 'be brief' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hi back' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty messages array', () => {
    const result = ChatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it('rejects unknown role', () => {
    const result = ChatMessageSchema.safeParse({ role: 'bot', content: 'hi' });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = ChatMessageSchema.safeParse({ role: 'user', content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects content over the 32k char limit', () => {
    const result = ChatMessageSchema.safeParse({
      role: 'user',
      content: 'x'.repeat(32_001),
    });
    expect(result.success).toBe(false);
  });
});
