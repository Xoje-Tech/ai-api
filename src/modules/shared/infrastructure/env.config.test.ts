import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { parseEnv } from './env.config.js';
import { logger } from './logger/logger.js';

vi.mock('./logger/logger.js', () => ({
  logger: {
    fatal: vi.fn(),
  },
}));

describe('Environment Configuration', () => {
  it('parses valid minimal environment', () => {
    const env = { AI_API_KEY: 'test-key' };
    const config = parseEnv(env);
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(5678);
    expect(config.AI_API_HOST).toBe('127.0.0.1');
    expect(config.AI_API_ALLOW_PUBLIC).toBe('false');
    expect(config.AI_API_KEY).toBe('test-key');
    expect(config.CIRCUIT_BREAKER_FAILURES).toBe(3);
    expect(config.CIRCUIT_BREAKER_COOLDOWN_MS).toBe(30000);
  });

  it('uses production default port 6789', () => {
    const env = { AI_API_KEY: 'test-key', NODE_ENV: 'production' };
    const config = parseEnv(env);
    expect(config.PORT).toBe(6789);
  });

  it('overrides port when provided', () => {
    const env = { AI_API_KEY: 'test-key', PORT: '9999' };
    const config = parseEnv(env);
    expect(config.PORT).toBe(9999);
  });

  it('exits process if AI_API_KEY is missing', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit() was called');
    });

    expect(() => parseEnv({})).toThrow('process.exit() was called');
    expect(logger.fatal).toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('exits process if AI_API_HOST is public without explicit override', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit() was called');
    });

    const env = { AI_API_KEY: 'test-key', AI_API_HOST: '0.0.0.0' };
    expect(() => parseEnv(env)).toThrow('process.exit() was called');
    expect(logger.fatal).toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('allows public host if AI_API_ALLOW_PUBLIC is true', () => {
    const env = { AI_API_KEY: 'test-key', AI_API_HOST: '0.0.0.0', AI_API_ALLOW_PUBLIC: 'true' };
    const config = parseEnv(env);
    expect(config.AI_API_HOST).toBe('0.0.0.0');
    expect(config.AI_API_ALLOW_PUBLIC).toBe('true');
  });
});
