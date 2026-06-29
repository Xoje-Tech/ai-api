import type { AIService } from '@ai-balancer/domain/ports/ai-service.port.js';

export interface Balancer {
  selectService(): AIService;
  recordSuccess(serviceName: string): void;
  recordFailure(serviceName: string): void;
}
