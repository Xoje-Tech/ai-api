import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAvailableProviders } from './provider.registry.js';
import * as groqAdapter from './adapters/groq.adapter.js';
import * as openRouterAdapter from './adapters/openrouter.adapter.js';
import * as nvidiaAdapter from './adapters/nvidia.adapter.js';
import { logger } from '../../shared/infrastructure/logger/logger.js';
import type { AIService } from '../domain/ports/ai-service.port.js';

vi.mock('../../shared/infrastructure/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./adapters/groq.adapter.js');
vi.mock('./adapters/openrouter.adapter.js');
vi.mock('./adapters/nvidia.adapter.js');

describe('Provider Registry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load all providers if instantiation succeeds', () => {
    const mockGroqService = { name: 'Groq' } as AIService;
    const mockOpenRouterService = { name: 'OpenRouter' } as AIService;
    const mockNvidiaService = { name: 'NVIDIA' } as AIService;

    vi.mocked(groqAdapter.createGroqClient).mockReturnValue({} as any);
    vi.mocked(groqAdapter.createGroqService).mockReturnValue(mockGroqService);
    
    vi.mocked(openRouterAdapter.createOpenRouterClient).mockReturnValue({} as any);
    vi.mocked(openRouterAdapter.createOpenRouterService).mockReturnValue(mockOpenRouterService);
    
    vi.mocked(nvidiaAdapter.createNvidiaService).mockReturnValue(mockNvidiaService);

    const services = loadAvailableProviders();

    expect(services).toHaveLength(3);
    expect(services).toContain(mockGroqService);
    expect(services).toContain(mockOpenRouterService);
    expect(services).toContain(mockNvidiaService);
    expect(logger.info).toHaveBeenCalledWith('Groq service loaded');
    expect(logger.info).toHaveBeenCalledWith('OpenRouter service loaded');
    expect(logger.info).toHaveBeenCalledWith('NVIDIA service loaded');
  });

  it('should catch errors and continue if a provider fails to instantiate', () => {
    const mockGroqService = { name: 'Groq' } as AIService;
    const mockNvidiaService = { name: 'NVIDIA' } as AIService;

    vi.mocked(groqAdapter.createGroqClient).mockReturnValue({} as any);
    vi.mocked(groqAdapter.createGroqService).mockReturnValue(mockGroqService);
    
    vi.mocked(openRouterAdapter.createOpenRouterClient).mockImplementation(() => {
      throw new Error('Missing API key');
    });
    
    vi.mocked(nvidiaAdapter.createNvidiaService).mockReturnValue(mockNvidiaService);

    const services = loadAvailableProviders();

    expect(services).toHaveLength(2);
    expect(services).toContain(mockGroqService);
    expect(services).toContain(mockNvidiaService);
    
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: 'Missing API key' }),
      'Failed to load OpenRouter service'
    );
  });

  it('should warn about missing environment variables', () => {
    delete process.env.GROQ_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test_key';
    
    loadAvailableProviders();

    expect(logger.warn).toHaveBeenCalledWith({ envVar: 'GROQ_API_KEY' }, 'missing env var');
    expect(logger.info).toHaveBeenCalledWith({ envVar: 'OPENROUTER_API_KEY' }, 'env var set');
  });
});
