import {
  createGroqClient,
  createGroqService,
} from './adapters/groq.adapter.js';
import {
  createOpenRouterClient,
  createOpenRouterService,
} from './adapters/openrouter.adapter.js';
import { createNvidiaService } from './adapters/nvidia.adapter.js';
import type { AIService } from '../domain/ports/ai-service.port.js';
import { logger } from '../../shared/infrastructure/logger/logger.js';

export function loadAvailableProviders(): AIService[] {
  logger.info('Checking environment variables...');

  const requiredEnvVars: Record<string, string | undefined> = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  };

  for (const [name, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      logger.warn({ envVar: name }, 'missing env var');
    } else {
      logger.info({ envVar: name }, 'env var set');
    }
  }

  const services: AIService[] = [];

  try {
    services.push(createGroqService(createGroqClient()));
    logger.info('Groq service loaded');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to load Groq service');
  }

  try {
    services.push(createOpenRouterService(createOpenRouterClient()));
    logger.info('OpenRouter service loaded');
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      'Failed to load OpenRouter service',
    );
  }

  try {
    services.push(createNvidiaService());
    logger.info('NVIDIA service loaded');
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      'Failed to load NVIDIA service',
    );
  }

  return services;
}
