# ai-api

A small, hexagonal, test-driven **model balancer** that switches between
free-tier LLM APIs (Groq, OpenRouter) with circuit-breaker failover, Zod
input validation, structured logging, and a health endpoint.

## Stack

- **Runtime**: Node.js + `tsx` (no Bun, despite the landing page title)
- **HTTP**: [Hono](https://hono.dev/) via `@hono/node-server`
- **LLM SDKs**: `groq-sdk`, `@openrouter/sdk`
- **DB**: `postgres` (driver), schema lives in legacy `db.ts` (not yet
  migrated to `src/modules/users/`)
- **Validation**: [Zod](https://zod.dev/) at HTTP boundaries
- **Logging**: [pino](https://getpino.io/), JSON to stdout by default
- **Testing**: [Vitest](https://vitest.dev/), co-located with source

## Quick start

```bash
pnpm install

export GROQ_API_KEY=***       # free at https://console.groq.com
export OPENROUTER_API_KEY=*** # free at https://openrouter.ai
export DATABASE_URL=...        # optional, only for /users CRUD

pnpm dev     # tsx watch src/index.ts
```

The server boots on `http://localhost:3000` (override with `PORT`).

## Endpoints

| Method | Path      | Body                | Returns                |
|--------|-----------|---------------------|------------------------|
| GET    | `/`       | —                   | HTML landing page      |
| GET    | `/health` | —                   | JSON service status    |
| POST   | `/chat`   | `{ messages: [...] }`| SSE stream (text/event-stream) |

### `POST /chat` body

```json
{
  "messages": [
    { "role": "system", "content": "be brief" },
    { "role": "user",   "content": "hi" }
  ]
}
```

`role` must be `user | assistant | system`. `content` is a non-empty
string up to 32 000 chars. 1–64 messages. Validation runs at the HTTP
boundary via Zod; bad bodies return `400` with the issue list.

### `GET /health` response

```json
{
  "status": "ok",
  "services": [{ "name": "Groq" }, { "name": "OpenRouter" }],
  "timestamp": "2026-06-29T17:42:15.612Z"
}
```

## Architecture

Hexagonal + screaming per `~/.hermes/skills/software-development/
project-doctrine`. Each business domain owns its own module under
`src/modules/`:

```
src/
├── app.ts                       — buildApp(opts) composition root
├── index.ts                     — runtime entrypoint
└── modules/
    ├── ai-balancer/             ← the model balancer
    │   ├── domain/ports/ai-service.port.ts            # AIService
    │   ├── application/
    │   │   ├── balancer/{balancer,round-robin,circuit-breaker}.ts
    │   │   └── use-cases/stream-chat.ts                # failover orchestrator
    │   ├── infrastructure/adapters/{groq,openrouter}.adapter.ts
    │   └── interface/
    │       ├── dto/chat-request.dto.ts                 # Zod
    │       └── routes/chat.route.ts                    # Hono handler
    ├── users/                    ← CRUD (migrated later)
    └── shared/
        ├── infrastructure/
        │   ├── http/response.ts                        # json/html/cors
        │   └── logger/logger.ts                         # pino
        └── interface/views/landing.ts                   # HTML
```

The composition root is `src/index.ts`. It loads the hexagonal
adapters, constructs a `CircuitBreakerBalancer` (threshold=3,
cooldown=30 s), and calls `buildApp({ services, balancer })`.

## Balancer strategy

The default production balancer is `CircuitBreakerBalancer`:

- **`round-robin`** by default (constructor order)
- after **3 consecutive failures**, marks the service `OPEN`
- after **30 s** in `OPEN`, the service becomes eligible again
- if **all** services are `OPEN`, the balancer falls back gracefully
  to the next candidate (degraded mode, request still goes through)

To swap strategy, instantiate a `RoundRobinBalancer` (simpler, no
breaker) and pass it to `buildApp({ balancer })`.

## Testing

```bash
pnpm test            # vitest watch mode
pnpm test:run        # single run, exit code useful in CI
pnpm test:coverage   # with v8 coverage
pnpm typecheck       # tsc --noEmit
```

Tests live next to source (`src/modules/.../foo.ts` plus
`foo.test.ts`). The 4 E2E tests in `src/__tests__/build-app.test.ts`
exercise the full HTTP surface through `app.request()` without binding
a port.

## Environment variables

| Var                  | Required          | Notes |
|----------------------|-------------------|-------|
| `GROQ_API_KEY`       | recommended       | Free at console.groq.com |
| `OPENROUTER_API_KEY` | recommended       | Free at openrouter.ai |
| `DATABASE_URL`       | only for `/users` | PostgreSQL connection string |
| `PORT`               | no (default 3000) | |
| `LOG_LEVEL`          | no (default info) | pino level: trace/debug/info/warn/error/fatal |
| `LOG_PRETTY`         | no                | `=1` for human-readable transport in dev |

If every LLM provider is missing at boot, the process exits with code
1.

## Legacy files

Two legacy files remain at the repo root pending a future phase:

- `db.ts` — Postgres connection (handled by the legacy `/users` route)
- `routes/users.ts` — CRUD for `/users` (not yet migrated to
  `src/modules/users/`)

The legacy `/chat` path is fully replaced; the migration of `/users`
is a future phase.
