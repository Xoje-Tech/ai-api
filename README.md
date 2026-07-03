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

### Local Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment:**
   Copy the example file and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   *Note: You will need at least one AI provider key (`GROQ_API_KEY` or `OPENROUTER_API_KEY`) and a secure `AI_API_KEY` for authentication.*

3. **Start the server:**
   ```bash
   pnpm dev     # tsx watch src/index.ts
   ```

The server boots on `http://127.0.0.1:3000` (override with `PORT`).

### Production via Docker

A `Dockerfile` and `docker-compose.yml` are provided for production deployments. The Docker build creates a lightweight Node 26 runtime image and isolates the build steps.

```bash
# Ensure your .env file is populated first
docker compose up -d --build
```

**Security Note (Host Binding & Auth):**
By design (defense in depth), the application binds only to `127.0.0.1` inside the container. To make it accessible from the host via Docker Compose, the `docker-compose.yml` explicitly sets:
- `AI_API_HOST=0.0.0.0`
- `AI_API_ALLOW_PUBLIC="true"` (Required to override the loopback-only safety check).

Additionally, all `/v1/*` routes (like `/v1/chat/completions`) require an `Authorization: Bearer <AI_API_KEY>` header. If `AI_API_KEY` is missing at boot, the server will exit.

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

All secrets come from the runtime environment. **Never commit secrets
to the repository.** See [Deployment](#deployment) for production
secret management.

If every LLM provider is missing at boot, the process exits with code
1.

## Legacy files

Two legacy files remain at the repo root pending a future phase:

- `db.ts` — Postgres connection (handled by the legacy `/users` route)
- `routes/users.ts` — CRUD for `/users` (not yet migrated to
  `src/modules/users/`)

The legacy `/chat` path is fully replaced; the migration of `/users`
is a future phase.

## Deployment

### Secrets management

All API keys (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL`,
etc.) are provided **exclusively through the runtime environment**.
The application itself has no built-in secret resolution — it reads
`process.env` at startup and logs a warning for any missing variable.

For any deployment target (production, staging, preview), secrets MUST
be provisioned through an external **secrets manager** such as:

| Provider | How |
|----------|-----|
| **Bitwarden Secrets Manager** | Fetch via `bws secret list <project> --output json` and export to the process environment |
| **Infisical** | `infisical run -- pnpm start` |
| **HashiCorp Vault** | Vault agent template + envconsul |
| **Docker/Kubernetes** | `--secret` / `Secret` resource mounted as env |
| **Cloud provider** | AWS Secrets Manager, GCP Secret Manager, Doppler, etc. |

The same principle applies locally: secrets are loaded by the Hermes
ecosystem through BWS — no `.env` file checked in.
