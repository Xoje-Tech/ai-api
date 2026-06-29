import type { AIService } from '@ai-balancer/domain/ports/ai-service.port.js';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  clock?: () => number;
}

export class CircuitBreakerBalancer {
  private readonly open = new Set<string>();
  private readonly openedAt = new Map<string, number>();
  private readonly failures = new Map<string, number>();
  private rrIndex = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly clock: () => number;

  constructor(
    private readonly services: readonly AIService[],
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 1;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.clock = options.clock ?? Date.now;
  }

  markOpen(serviceName: string): void {
    this.open.add(serviceName);
    this.openedAt.set(serviceName, this.clock());
  }

  recordFailure(serviceName: string): void {
    const current = (this.failures.get(serviceName) ?? 0) + 1;
    this.failures.set(serviceName, current);
    if (current >= this.failureThreshold) {
      this.open.add(serviceName);
      this.openedAt.set(serviceName, this.clock());
    }
  }

  recordSuccess(serviceName: string): void {
    this.failures.delete(serviceName);
  }

  private isHealthy(serviceName: string): boolean {
    if (!this.open.has(serviceName)) return true;
    const openedAt = this.openedAt.get(serviceName);
    if (openedAt === undefined) return false;
    if (this.clock() - openedAt >= this.cooldownMs) {
      this.open.delete(serviceName);
      this.openedAt.delete(serviceName);
      this.failures.delete(serviceName);
      return true;
    }
    return false;
  }

  selectService(): AIService {
    let attempts = 0;
    while (attempts < this.services.length) {
      const candidate = this.services[this.rrIndex]!;
      this.rrIndex = (this.rrIndex + 1) % this.services.length;
      if (this.isHealthy(candidate.name)) return candidate;
      attempts++;
    }
    const fallback = this.services[this.rrIndex]!;
    this.rrIndex = (this.rrIndex + 1) % this.services.length;
    return fallback;
  }
}
