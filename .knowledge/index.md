---
type: Index
title: Knowledge Bundle Index
description: Hand-maintained catalog of every page in the ai-api OKF bundle. Auto-generated pages (adapters, api, env) are listed alongside hand-written architecture notes.
resource: .knowledge/
tags: [okf, index]
timestamp: 2026-06-29T23:30:00Z
---

# Knowledge Bundle

This bundle is the project's OKF (Open Knowledge Format) knowledge base. Every
markdown file in this directory is a concept page. Auto-generated pages
(`adapters/`, `api/endpoints.md`, `env/variables.md`) are rewritten by
`scripts/regenerate-knowledge.ts` whenever the source they reference changes.
Hand-written pages (`architecture/`) are curated by humans — the regenerator
never touches them.

## When to read this bundle

- **Session start** for any agent working on this repo — read `index.md`, then
  dive into the relevant concept page based on the task.
- **Adding a new adapter / route / env var** — the auto-generated pages will
  update automatically via the pre-commit hook. Hand-written runbooks live in
  `architecture/`.
- **Onboarding** — start at `architecture/circuit-breaker-balancer.md` for the
  production load-balancing policy, then explore outward.

## How the bundle is organised

- `adapters/` — **auto-generated**. One file per adapter under
  `src/modules/*/infrastructure/adapters/`. Schema: name, factory, SDK package,
  env vars, source path.
- `api/` — **auto-generated**. Single file enumerating every HTTP route across
  `src/app.ts` and per-module route handlers.
- `env/` — **auto-generated**. Single file mirroring `.env.example`.
- `architecture/` — **hand-written**. Architectural decisions, runbooks, and
  patterns. These never get regenerated; humans own them.
- `log.md` — **append-only**. The regenerator appends a timestamped line every
  time it runs.

## Pages

### Adapters (auto-generated)

- [Groq adapter](./adapters/groq.md) — production adapter for `groq-sdk`,
  primary free-tier provider.
- [OpenRouter adapter](./adapters/openrouter.md) — production adapter for
  `@openrouter/sdk`, OpenAI-compatible aggregator.

### API surface (auto-generated)

- [HTTP endpoints](./api/endpoints.md) — every route exposed by `src/app.ts`
  plus per-module route handlers.

### Environment (auto-generated)

- [Environment variables](./env/variables.md) — every var declared in
  `.env.example`.

### Architecture (hand-written)

- [Circuit Breaker Balancer](./architecture/circuit-breaker-balancer.md) —
  production load-balancing policy with failure threshold + cooldown.
- [Round-Robin Balancer](./architecture/round-robin-balancer.md) — naive
  rotation used by `buildApp` defaults and tests.

### Changelog

- [Bundle log](./log.md) — append-only history of regeneration events.

## Related

- [`AGENTS.md`](../AGENTS.md) — agent entry point; explains how to use this
  bundle alongside the source code.
- [`scripts/regenerate-knowledge.ts`](../scripts/regenerate-knowledge.ts) —
  regenerator source (parsers + writers).
- [`scripts/lint-knowledge-bundle.ts`](../scripts/lint-knowledge-bundle.ts) —
  frontmatter + link checker.
- Open Knowledge Format spec: <https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing>