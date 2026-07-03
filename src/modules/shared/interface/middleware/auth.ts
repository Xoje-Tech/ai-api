import { timingSafeEqual } from 'node:crypto';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Context, Next } from 'hono';

export interface BearerAuthOptions {
  envKeyName: string;            // 'AI_API_KEY'
  exemptMethods?: string[];      // default ['OPTIONS']
  exemptPathPrefixes?: string[]; // default ['/health']
}

/**
 * OpenAI-shaped error envelope helper. Centralised so 401/500 responses
 * stay consistent (and so we don't accidentally include the key in
 * any future copy-paste of the error shape).
 */
function openAIError(
  c: Context,
  status: ContentfulStatusCode,
  type: string,
  message: string,
): Response {
  return c.json({ error: { type, message } }, status);
}

export function requireBearer(opts: BearerAuthOptions) {
  const { envKeyName, exemptMethods = ['OPTIONS'], exemptPathPrefixes = ['/health'] } = opts;
  return async (c: Context, next: Next) => {
    if (exemptMethods.includes(c.req.method)) return next();
    if (exemptPathPrefixes.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
      return next();
    }
    const expected = process.env[envKeyName];
    if (!expected) {
      // Defense-in-depth: bootstrap should have exited. Never leak the key in the message.
      return openAIError(c, 500, 'server_error', 'server misconfigured');
    }
    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      return openAIError(c, 401, 'invalid_request_error', 'Missing or invalid API key');
    }
    const a = Buffer.from(header.slice('Bearer '.length), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    // Length pre-check first — timingSafeEqual throws RangeError on mismatch.
    // Length-mismatch path reveals length, but the client chose that, so no side channel.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return openAIError(c, 401, 'invalid_request_error', 'Invalid API key');
    }
    return next();
  };
}
