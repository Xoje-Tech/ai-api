import { z } from 'zod';
import { logger } from './logger/logger.js';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().optional(),
    AI_API_HOST: z.string().default('127.0.0.1'),
    AI_API_ALLOW_PUBLIC: z.enum(['true', 'false']).default('false'),
    AI_API_KEY: z.string().min(1, 'AI_API_KEY is required to serve /v1/* routes'),
    CIRCUIT_BREAKER_FAILURES: z.coerce.number().default(3),
    CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().default(30000),
  })
  .superRefine((data, ctx) => {
    // Loopback protection
    const isLoopback = data.AI_API_HOST === '127.0.0.1' || data.AI_API_HOST === '::1';
    if (!isLoopback && data.AI_API_ALLOW_PUBLIC !== 'true') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AI_API_HOST points at a non-loopback address — set AI_API_ALLOW_PUBLIC=true to override',
        path: ['AI_API_HOST'],
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema> & { PORT: number };

export function parseEnv(env: Record<string, string | undefined>): EnvConfig {
  const parsed = envSchema.safeParse(env);
  
  if (!parsed.success) {
    logger.fatal({ issues: parsed.error.format() }, 'Invalid environment configuration');
    process.exit(1);
  }

  const defaultPort = parsed.data.NODE_ENV === 'production' ? 6789 : 5678;

  return {
    ...parsed.data,
    PORT: parsed.data.PORT ?? defaultPort,
  };
}
