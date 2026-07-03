# Proposal: Use ai-api as fallback provider for hermes

## Intent
OpenAI-compatible routes ship, but no supervision, no auth, default `0.0.0.0` bind (quota-drain), zero OpenAI-route tests. Graduate to a loopback fallback provider hermes can point `base_url` at (dev-tracker Docker pattern) with mandatory Bearer.

## Scope
**In**: Bearer on /v1/* (constant-time vs AI_API_KEY); loopback-by-default (127.0.0.1); model-echo + 6-test suite; multi-stage Dockerfile + compose + .dockerignore (dev-tracker); AI_API_KEY/AI_API_HOST in .env.example; AGENTS.md Quick Start.
**Out**: Postgres, mid-stream failover, tools/function-calling, observability, per-user limits, key rotation, hermes-side config.

## Capabilities (all NEW, openspec/specs/ empty)
- api-runtime — lifecycle, loopback bind, healthcheck, restart-on-failure, env config
- v1-auth — OpenAI-shaped Bearer on /v1/*, constant-time, 401 {error:{type,message}}, exempts GET /health + OPTIONS *
- openai-route-contract — shape, model-echo, usage, SSE [DONE] for /v1/chat/completions + /v1/models; chat-only
- deployment-v1-0 — multi-stage Dockerfile, single-service compose (127.0.0.1:3000:3000), .dockerignore, env wiring, HEALTHCHECK against container-internal /health

## Approach
D1+A1+B1+C1: Docker Compose (dev-tracker pattern), shared AI_API_KEY, InMemoryUserRepository. Strict TDD (auth middleware → bind → InMemory → Dockerfile → docs → smoke).

## Affected Areas
- New: auth.ts middleware; openai-chat.route.test.ts (6 tests: JSON, SSE [DONE], model-echo, 401×2, 400 empty); Dockerfile + compose + .dockerignore (multi-stage, node:26-slim, non-root, 127.0.0.1:3000:3000)
- Modified: src/index.ts (loopback default, force InMemory, refuse start without AI_API_KEY); src/app.ts (install middleware before app.all('*')); openai-chat.route.ts (accept client model, usage zeros v1.0); .env.example (add AI_API_KEY/AI_API_HOST, deprecate DATABASE_URL); AGENTS.md (Quick Start uses `docker compose up -d`)
- Auto-regen only: .knowledge/{api/endpoints,env/variables}.md

## Risks
- Quota-drain if 0.0.0.0+no auth — auth mandatory regardless of bind
- AI_API_KEY rotation manual — `docker compose restart` after env edit
- No function-calling v1.0 — chat-only, tools dropped at Zod
- Mid-stream 429/5xx aborts SSE — accepted v1.0, follow-up change
- Hermes-side config out of repo — user action item

## Rollback
`docker compose down` → `git revert <merge-commit>` on master → delete Dockerfile/compose if revert missed. No data loss (InMemory ephemeral).

## Dependencies
Hermes (base_url=http://127.0.0.1:3000/v1, inject AI_API_KEY); BWS (store AI_API_KEY alongside GROQ_API_KEY/OPENROUTER_API_KEY); Docker; pnpm 11.9 + Node 26 in image; regenerator already correct.

## Success Criteria
- [ ] pnpm test:run passes 6+ new tests (JSON, SSE [DONE], model-echo, 401×2, 400 empty)
- [ ] `docker compose up -d` healthy; `/health` 200 ≤5s
- [ ] Authed POST /v1/chat/completions echoes client model in OpenAI envelope; unauthed → 401
- [ ] Service refuses start when AI_API_KEY unset + /v1/* on
- [ ] .knowledge pages updated post `pnpm knowledge:regen`

## Proposal Assumptions
(a) hermes sole external client — single-tenant, single-key; (b) loopback only by default, override + auth required; (c) shared Bearer AI_API_KEY, no per-user/scopes/rotation; (d) Postgres deferred — InMemory only, PostgresUserRepository unwired in code, DATABASE_URL removed from .env.example; (e) /users/* untouched; (f) tools/function-calling dropped at Zod, chat-only; (g) mid-stream failover deferred, service.chat() throws only.
