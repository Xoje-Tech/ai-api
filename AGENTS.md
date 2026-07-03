# AGENTS.md — ai-api

> Entry point for any AI agent working on the ai-api project. Read this first before making changes.

---

## What is ai-api

A **model balancer** between free-tier LLM APIs (Groq, OpenRouter) using round-robin SSE streaming. Designed to fail-over gracefully when one provider rate-limits or goes down.

- **Stack:** Node.js + TypeScript + Hono 4 + Postgres + Zod + Pino
- **SDKs:** `groq-sdk`, `@openrouter/sdk`
- **Test runner:** Vitest 4
- **Architecture:** Hexagonal + Screaming (`src/modules/{domain}/{application,domain,infrastructure,interface}/`)

---

## Quick Start

```bash
cd /home/hermes/projects/ai-api
pnpm install
cp .env.example .env   # then fill in real keys
pnpm db:push           # Postgres schema sync (if DATABASE_URL set)
pnpm test:run          # smoke check
pnpm dev               # start dev server (tsx watch) on :3000
```

Health check: `curl http://localhost:3000/health`

---

## Essential Commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start dev server with hot reload (tsx watch) |
| `pnpm start` | Run production server (tsx, no watch) |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once (CI mode) |
| `pnpm test:coverage` | Run tests with v8 coverage |
| `pnpm typecheck` | `tsc --noEmit` |

---

## Environment Variables

Configured in `.env` (see `.env.example`):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes (for users/) | `postgresql://user:pass@host:5432/db` |
| `GROQ_API_KEY` | yes (for Groq adapter) | Free tier at console.groq.com |
| `OPENROUTER_API_KEY` | yes (for OpenRouter adapter) | Free tier at openrouter.ai |
| `PORT` | no | Default 3000 |
| `NODE_ENV` | no | `development` \| `production` \| `test` |
| `LOG_LEVEL` | no | `debug` \| `info` \| `warn` \| `error` |

**Startup will fail loudly** if a required key for an active adapter is missing.

---

## Project Structure

```
ai-api/
├── src/
│   ├── index.ts              # Bootstrap: connect DB + listen
│   └── modules/
│       ├── ai-balancer/      # Core domain: provider adapters + load balancing
│       │   ├── application/  # Use cases (sendMessage, streamChat, etc.)
│       │   ├── domain/       # Entities + repository interfaces (ports)
│       │   ├── infrastructure/  # Adapter implementations (Groq/OpenRouter)
│       │   └── interface/    # Hono routes
│       ├── shared/           # Cross-cutting concerns
│       │   ├── infrastructure/  # HTTP helpers, env loader
│       │   └── interface/    # Health endpoint
│       └── users/            # User persistence (Postgres-backed)
│           ├── application/
│           ├── domain/
│           ├── infrastructure/  # PostgresUserRepository
│           └── interface/
├── tests/                    # Co-located or here (per §3 doctrine)
├── .env.example              # Template
├── package.json              # ESM, pnpm
├── tsconfig.json
└── vitest.config.ts
```

---

## Architecture Conventions

### Code Style
- **Strict TypeScript** — strict mode, no `any` without justification
- **ESM modules** — `.js` extensions on all imports
- **Hexagonal** — domain depends on nothing; application depends on domain interfaces; infrastructure implements interfaces
- **Zod for validation** — env vars and request bodies
- **Pino for logging** — structured JSON

### Adapter Pattern (ai-balancer)
Each provider (Groq/OpenRouter) is an adapter implementing the same port interface. Adding a new provider:
1. Create `src/modules/ai-balancer/infrastructure/<provider>.ts`
2. Implement the same port as existing adapters
3. Register in the bootstrap (`src/index.ts`) if auto-load is not in place
4. Add SDK to `package.json`

### Testing
- **Vitest 4** — globals, node environment
- **Co-location** — tests live next to source as `<file>.test.ts` (per §3 doctrine)
- **Coverage target** — 80% statements / 70% branches
- **No mocking own domain logic** — only mock external SDK boundaries

---

## Key Behaviors

- **Round-robin SSE** — balancer rotates between active providers per request
- **Graceful failover** — on provider error, retries with next adapter before returning 5xx
- **Database optional at boot** — startup logs warning if `DATABASE_URL` missing, but server still serves traffic
- **Health endpoint** — `GET /health` reports liveness + per-adapter status

---

## SDD Pipeline

This project lives in the `software-dev` Hermes profile. For substantial changes:

```
/sdd-new <change-name>     # creates explore → propose → spec → design → tasks
/sdd-apply <change-name>   # implements tasks
/sdd-verify <change-name>  # validates against specs
/sdd-archive <change-name> # closes the change
```

Do not skip phases. Strict TDD mode is active (write test first, watch it fail, write code, watch it pass).

---

## Known Debt (as of 2026-06-29)

- **No `docker-compose.yml`** — Postgres setup is host-local
- **`users/` module** — PostgresUserRepository recently wired in entrypoint (commit `3096e82`); migrations TBD

---

## Knowledge Bundle (OKF)

The project ships an [Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing) bundle at `.knowledge/`. Every markdown file in there is a concept page with YAML frontmatter (OKF v0.1 spec: `type` required, `title`/`description`/`resource`/`tags`/`timestamp` optional).

**Before working on this codebase, read `.knowledge/index.md` and the relevant concept pages.** They contain the curated architectural context that complements this file.

### Layout

| Path | Owner | Regenerated when |
|------|-------|------------------|
| `.knowledge/adapters/*.md` | auto-generated | an adapter source changes |
| `.knowledge/api/endpoints.md` | auto-generated | a route handler changes |
| `.knowledge/env/variables.md` | auto-generated | `.env.example` changes |
| `.knowledge/architecture/*.md` | **hand-written** | humans curate; never overwritten |
| `.knowledge/index.md` | **hand-written** | humans curate; never overwritten |
| `.knowledge/log.md` | **append-only** | regenerator appends a line per run |

### Commands

| Command | What it does |
|---------|--------------|
| `pnpm knowledge:regen` | Regenerate every auto-generated page from current source. Idempotent (re-running produces the same output, except `log.md` which appends). |
| `pnpm knowledge:lint` | Validate every page has OKF frontmatter + no broken markdown links. Exits 1 on CRITICAL issues. |
| *(automatic)* | The husky `pre-commit` hook runs `lint-staged`, which regenerates the matching bundle section when adapters/routes/env files are staged. |

### Rules

- **Hand-written pages are sacred.** Never let the regenerator touch `architecture/` or `index.md`. If a regeneration would overwrite one of them, that's a bug in the regenerator — fix the script, not the data.
- **Adding a new concept that isn't an adapter/route/env var?** Create a hand-written page in `architecture/` (or a new top-level section). Update `index.md` to link to it.
- **Updating the regenerator logic?** Update the matching test first. Strict TDD applies.

---

*Last updated: 2026-06-29*