---
type: Architecture Pattern
title: Circuit Breaker Balancer
description: Round-robin selection with per-service failure threshold + cooldown; production balancer wired in src/index.ts.
resource: src/modules/ai-balancer/application/balancer/circuit-breaker-balancer.ts
tags: [architecture, balancer, circuit-breaker, failover]
timestamp: 2026-06-29T22:00:00Z
---

# Circuit Breaker Balancer

`CircuitBreakerBalancer` is the production balancer. It implements `Balancer`
interface but **does not declare it explicitly** — duck-typed via `selectService`,
`recordSuccess`, `recordFailure`.

## Source

`src/modules/ai-balancer/application/balancer/circuit-breaker-balancer.ts`

## State

| Field | Purpose |
|-------|---------|
| `open: Set<string>` | Service names currently OPEN (skipped in selection). |
| `openedAt: Map<string, number>` | When each OPEN service was opened (clock-dependent). |
| `failures: Map<string, number>` | Consecutive failure counter per service. |
| `rrIndex: number` | Round-robin cursor. |

## Configuration (constructor options)

| Option | Default | Meaning |
|--------|---------|---------|
| `failureThreshold` | `1` | After this many consecutive failures, the service opens. |
| `cooldownMs` | `30_000` | Time an OPEN service stays OPEN before becoming eligible again. |
| `clock` | `Date.now` | Injected for deterministic tests. |

`src/index.ts` instantiates with `{ failureThreshold: 3, cooldownMs: 30_000 }`.

## Selection algorithm (`selectService`)

1. Iterate up to `services.length` times.
2. On each step, pick `services[rrIndex]`, increment `rrIndex` mod length.
3. If `isHealthy(name)` is `true`, return it.
4. `isHealthy` returns `true` if the service is not OPEN OR if
   `clock() - openedAt >= cooldownMs` — in the latter case the service is
   closed (`open.delete`, `openedAt.delete`, `failures.delete`).

If every service is OPEN, the loop exits and the function falls through to a
**degraded fallback**: it returns the next rr-positioned service regardless of
state and increments the cursor. This keeps traffic flowing at the cost of
acknowledged unreliability.

## Failure / success bookkeeping

- `recordFailure(name)` — increment counter; if `>= threshold`, mark OPEN with
  `openedAt = clock()`.
- `recordSuccess(name)` — delete the failure counter (does NOT close an OPEN
  service early; cooldown still applies).
- `markOpen(name)` — public API to forcibly open a service (test-only escape
  hatch).

## Used by

- `src/index.ts` (production wiring)
- `streamChat` use-case in
  [`src/modules/ai-balancer/application/use-cases/stream-chat.ts`](../../src/modules/ai-balancer/application/use-cases/stream-chat.ts)
  — on a thrown `service.chat(messages)`, the use-case calls
  `balancer.recordFailure(service.name)` and rotates to the next attempt.

## Related

- [Round-robin balancer](./round-robin-balancer.md) — simpler alternative
  without breaker semantics.
- [Groq adapter](../adapters/groq.md) and [OpenRouter adapter](../adapters/openrouter.md) — the services this balancer picks between.
- [Endpoints](../api/endpoints.md) — every chat endpoint ultimately funnels
  through this balancer via `streamChat`.