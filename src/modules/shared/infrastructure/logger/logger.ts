import pino from 'pino';

/**
 * Application-wide structured logger. Replaces ad-hoc console.*
 * calls in production code with a single pino instance.
 *
 * Default: JSON to stdout (production-friendly, greppable, parseable).
 * Set LOG_PRETTY=1 to switch to a human-readable transport during
 * local development.
 */
const usePretty = process.env.LOG_PRETTY === '1';

export const logger = usePretty
  ? pino({
      level: process.env.LOG_LEVEL ?? 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      },
    })
  : pino({ level: process.env.LOG_LEVEL ?? 'info' });

export type Logger = typeof logger;
