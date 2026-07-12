import { describe, it, expect } from 'vitest';
import { RoundRobinBalancer } from '@ai-balancer/application/balancer/round-robin-balancer.js';
import type { AIService } from '@ai-balancer/domain/ports/ai-service.port.js';

const stubService = (name: string): AIService => ({
  name, models: [],
  chat: async () => (async function* () {})(),
});

describe('RoundRobinBalancer', () => {
  it('rotates through services in order, looping back to the first', () => {
    const services = [stubService('A'), stubService('B')];
    const balancer = new RoundRobinBalancer(services);

    expect(balancer.selectService().name).toBe('A');
    expect(balancer.selectService().name).toBe('B');
    expect(balancer.selectService().name).toBe('A');
  });
});
