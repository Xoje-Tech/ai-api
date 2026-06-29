import { describe, it, expect } from 'vitest';
import { CircuitBreakerBalancer } from '@ai-balancer/application/balancer/circuit-breaker-balancer.js';
import type { AIService } from '@ai-balancer/domain/ports/ai-service.port.js';

const stubService = (name: string): AIService => ({
  name,
  chat: async () => (async function* () {})(),
});

describe('CircuitBreakerBalancer', () => {
  it('skips services marked as OPEN', () => {
    const services = [stubService('A'), stubService('B')];
    const balancer = new CircuitBreakerBalancer(services);

    balancer.markOpen('A');

    expect(balancer.selectService().name).toBe('B');
    expect(balancer.selectService().name).toBe('B');
    expect(balancer.selectService().name).toBe('B');
  });

  it('marks a service OPEN after N consecutive failures', () => {
    const services = [stubService('A'), stubService('B')];
    const balancer = new CircuitBreakerBalancer(services, { failureThreshold: 3 });

    balancer.recordFailure('A');
    balancer.recordFailure('A');
    balancer.recordFailure('A');

    expect(balancer.selectService().name).toBe('B');
  });

  it('resets failure count on success', () => {
    const services = [stubService('A'), stubService('B')];
    const balancer = new CircuitBreakerBalancer(services, { failureThreshold: 3 });

    balancer.recordFailure('A');
    balancer.recordFailure('A');
    balancer.recordSuccess('A');
    balancer.recordFailure('A');
    balancer.recordFailure('A');

    expect(balancer.selectService().name).toBe('A');
  });

  it('closes a service after cooldownMs has elapsed since opening', () => {
    const services = [stubService('A'), stubService('B')];
    let now = 1000;
    const clock = () => now;
    const balancer = new CircuitBreakerBalancer(services, {
      failureThreshold: 1,
      cooldownMs: 5000,
      clock,
    });

    balancer.markOpen('A');
    expect(balancer.selectService().name).toBe('B');

    now = 7000;

    expect(balancer.selectService().name).toBe('A');
  });

  it('returns a service even when all are OPEN (graceful degradation)', () => {
    const services = [stubService('A'), stubService('B')];
    const balancer = new CircuitBreakerBalancer(services);

    balancer.markOpen('A');
    balancer.markOpen('B');

    const selected = balancer.selectService();
    expect(['A', 'B']).toContain(selected.name);
  });
});
