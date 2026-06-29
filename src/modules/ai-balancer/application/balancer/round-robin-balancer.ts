import type { AIService } from '../../domain/ports/ai-service.port.js';
import type { Balancer } from './balancer.js';

export class RoundRobinBalancer implements Balancer {
  private currentIndex = 0;

  constructor(private readonly services: readonly AIService[]) {}

  selectService(): AIService {
    const service = this.services[this.currentIndex]!;
    this.currentIndex = (this.currentIndex + 1) % this.services.length;
    return service;
  }

  recordSuccess(_serviceName: string): void {}

  recordFailure(_serviceName: string): void {}
}
