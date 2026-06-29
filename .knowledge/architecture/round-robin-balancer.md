---
type: Architecture Pattern
title: Round-Robin Balancer
description: Naive rotating selector with no breaker state; the default when callers don't pass a balancer.
resource: src/modules/ai-balancer/application/balancer/round-robin-balancer.ts
tags: [architecture, balancer, round-robin]
timestamp: 2026-06-29T22:00:00Z
---

# Round-Robin Balancer

`RoundRobinBalancer` is the simplest implementation of the [`Balancer`](./circuit-breaker-balancer.md)
interface: pure rotation, no failure state, no cooldown.

## Source

`src/modules/ai-balancer/application/balancer/round-robin-balancer.ts`

## State

| Field | Purpose |
|-------|---------|
| `currentIndex: number` | Cursor into `services`. Starts at `0`. |

The constructor takes a readonly `services: readonly AIService[]`. There is
no setter or mutation API beyond `selectService`.

## Selection algorithm

```ts
selectService(): AIService {
  const service = this.services[currentIndex]!;
  currentIndex = (currentIndex + 1) % services.length;
  return service;
}
```

That's the whole algorithm — no health check, no fallback. If a service
throws, the caller (`streamChat`) catches it, calls `recordFailure` (a no-op
here), and asks `selectService()` for the next one. Over many requests the
cursor distributes traffic evenly across all adapters.

## `recordSuccess` / `recordFailure`

Both are explicit no-ops. The class satisfies the `Balancer` interface but
imposes no breaker policy; that responsibility belongs to
[`CircuitBreakerBalancer`](./circuit-breaker-balancer.md).

## Used by

- `src/app.ts` — `buildApp` defaults to `RoundRobinBalancer` when the caller
  does not pass a `balancer` option, preserving legacy round-robin behaviour
  for tests and ad-hoc wiring.
- `src/__tests__/build-app.test.ts` — the chat-streaming test passes two
  stubs and asserts the first service is selected first.

## When to use this vs. the breaker balancer

- **Use `RoundRobinBalancer`** when testing the request shape, when running a
  single fixed adapter, or when the upstream traffic mix is even and provider
  outages are not a concern.
- **Use `CircuitBreakerBalancer`** in production where one provider's outage
  would otherwise drag the latency or error budget of every request.

## Related

- [Circuit breaker balancer](./circuit-breaker-balancer.md) — adds threshold
  + cooldown on top of this rotation strategy.
- [Groq adapter](../adapters/groq.md) and [OpenRouter adapter](../adapters/openrouter.md) — the services it rotates between.
- [Endpoints](../api/endpoints.md) — every chat endpoint goes through whichever
  balancer is wired in `buildApp`.