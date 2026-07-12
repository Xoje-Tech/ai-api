import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

export interface ModelInfo {
  providerId: string;
  modelId: string;
  contextWindow: number;
}

export function getAvailableModelsForContext(tokens: number): ModelInfo[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const registryPath = path.resolve(__dirname, 'provider-registry.json');
  
  try {
    const data = fs.readFileSync(registryPath, 'utf8');
    const registry = JSON.parse(data);
    
    const available: ModelInfo[] = [];
    for (const [providerId, providerData] of Object.entries(registry)) {
      const models = (providerData as any).models || {};
      for (const [modelId, modelData] of Object.entries(models)) {
        const cw = (modelData as any).context_window || (modelData as any).contextWindow;
        if (cw && cw >= tokens) {
          available.push({
            providerId,
            modelId,
            contextWindow: cw,
          });
        }
      }
    }
    return available.sort((a, b) => a.contextWindow - b.contextWindow);
  } catch (err) {
    logger.error({ err }, 'Failed to read provider registry');
    return [];
  }
}

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
