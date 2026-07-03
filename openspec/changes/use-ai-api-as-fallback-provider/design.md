# Design: Use ai-api as fallback provider for hermes

## Context

ai-api ships an OpenAI-compatible HTTP surface (`POST /v1/chat/completions` JSON + SSE, `GET /v1/models`) but is **unauthenticated, bound to `0.0.0.0`, unsupervised, and has zero test coverage on the OpenAI route** — a quota-drain vector the moment it's reachable beyond the host. This change graduates it into a supervised, loopback-only, Bearer-authenticated fallback provider that hermes points `base_url` at via Docker Compose, mirroring dev-tracker's graduation. Four specs drive the change: `api-runtime` (lifecycle + bind + InMemory fallback + startup-fail), `v1-auth` (Bearer on `/v1/*`, constant-time, 401 envelope, exempt paths), `openai-route-contract` (JSON + SSE shapes, model echo, `[DONE]`, usage zeros v1.0), `deployment-v1-0` (multi-stage Dockerfile, single-service Compose on `127.0.0.1:3000:3000`, `.dockerignore`, env wiring, in-container healthcheck). Hermes-side config is out of scope — see **Hermes-Side Action Item**.

## Goals / Non-Goals

**Goals.** (1) Bearer-auth on `/v1/*` with constant-time compare and OpenAI-shaped 401; (2) loopback-by-default bind (`127.0.0.1`) with explicit override; (3) startup fails fast if `AI_API_KEY` unset; (4) client-supplied `model` echoes in the response; (5) 10 new tests (4 route-shape + 6 auth) green under `pnpm test:run`; (6) multi-stage Dockerfile + Compose + `.dockerignore` matching dev-tracker; (7) `/health` 200 ≤5s after `docker compose up -d`.

**Non-Goals.** Postgres sidecar / `DATABASE_URL` (InMemory only); tools / function-calling (silently dropped at Zod); mid-stream failover; observability; per-user keys; `AI_API_KEY` rotation; hermes config edits.

## Architecture

```
client ─POST /v1/chat/completions─▶ app.use('*', requireBearer)   ← NEW (Hono middleware, position 1)
                                   │ skip OPTIONS *
                                   │ skip path === '/health'
                                   │ timingSafeEqual(Buffer, Buffer)
                                   │ 401 OpenAI envelope on miss
                                   ▼
                               app.all('*') dispatcher             ← unchanged
                                   ▼
                               handleOpenAIChat (model echo fixed) ← modified
                                   ▼
                               streamChat → CircuitBreakerBalancer → Groq | OpenRouter
                                   ▼
                               200 text/event-stream: role → content* → finish_reason → data: [DONE]\n\n
```

Hono runs `app.use` middlewares in registration order, before any handler. Placing `requireBearer` first ensures it sees every request before the catch-all `app.all('*', ...)` returns 404 or CORS. The middleware handles its own exempt logic (path prefix + method) so the dispatcher stays single-call. Auth applies to every path that isn't OPTIONS or `/health` (per `v1-auth`). `/users/*` remains unauthenticated — not in the OpenAI surface, out of scope this change.

## Components

### `src/modules/shared/interface/middleware/auth.ts` (new, ~50 LOC)

```ts
import { timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';

export interface BearerAuthOptions {
  envKeyName: string;            // 'AI_API_KEY'
  exemptMethods?: string[];      // default ['OPTIONS']
  exemptPathPrefixes?: string[]; // default ['/health']
}

export function requireBearer(opts: BearerAuthOptions) {
  const { envKeyName, exemptMethods = ['OPTIONS'], exemptPathPrefixes = ['/health'] } = opts;
  return async (c: Context, next: Next) => {
    if (exemptMethods.includes(c.req.method)) return next();
    if (exemptPathPrefixes.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
      return next();
    }
    const expected = process.env[envKeyName];
    if (!expected) {
      // Defense-in-depth: bootstrap should have exited. Never leak the key in the message.
      return c.json({ error: { type: 'server_error', message: 'server misconfigured' } }, 500);
    }
    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: { type: 'invalid_request_error', message: 'Missing or invalid API key' } }, 401);
    }
    const a = Buffer.from(header.slice('Bearer '.length), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    // Length pre-check first — timingSafeEqual throws RangeError on mismatch.
    // Length-mismatch path reveals length, but the client chose that, so no side channel.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: { type: 'invalid_request_error', message: 'Invalid API key' } }, 401);
    }
    return next();
  };
}
```

### `src/app.ts` (modify, +2 LOC)

Insert immediately after `const app = new Hono();`:

```ts
app.use('*', requireBearer({ envKeyName: 'AI_API_KEY', exemptPathPrefixes: ['/health'] }));
```

### `src/index.ts` (modify, +18 / −24 LOC)

1. **Remove** the `DATABASE_URL` switch (current lines 71-92). Always wire `InMemoryUserRepository`. `PostgresUserRepository` stays in the codebase, unwired.
2. **Add** startup-fail check immediately after service-discovery:

```ts
if (!process.env.AI_API_KEY) {
  logger.fatal({ envVar: 'AI_API_KEY' }, 'AI_API_KEY is required to serve /v1/* routes — exiting');
  process.exit(1);
}
```

3. **Replace** `hostname: '0.0.0.0'` with `process.env.AI_API_HOST ?? '127.0.0.1'`, plus public-bind guard (per `api-runtime`):

```ts
const host = process.env.AI_API_HOST ?? '127.0.0.1';
if (host !== '127.0.0.1' && host !== '::1' && process.env.AI_API_ALLOW_PUBLIC !== 'true') {
  logger.fatal({ host }, 'AI_API_HOST points at a non-loopback address — set AI_API_ALLOW_PUBLIC=true to override');
  process.exit(1);
}
```

### `src/modules/ai-balancer/interface/routes/openai-chat.route.ts` (modify, +6 / −1 LOC)

Change `handleOpenAIChat(req, balancer, model = 'openrouter/free')` to read `model` from the parsed request first:

```ts
export async function handleOpenAIChat(req: Request, balancer: Balancer): Promise<Response> {
  // ...after OpenAIChatRequestSchema.safeParse...
  const { messages, stream, model: clientModel } = parsed.data;
  const model = clientModel ?? 'openrouter/free';
  // Use `model` everywhere below instead of the signature default
}
```

`usage` block stays `{ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }` per `openai-route-contract` "Usage May Be Zero".

### `Dockerfile` (new, multi-stage)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:26-bookworm AS build
WORKDIR /app
RUN npm install -g corepack@latest && corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm typecheck

FROM node:26-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
USER node
ENV NODE_ENV=production PORT=3000 AI_API_HOST=127.0.0.1
EXPOSE 3000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["pnpm", "start"]
```

Notes: `node:26-bookworm` build / `node:26-slim` runtime per spec; **no `pnpm build`** because `tsx src/index.ts` runs TS directly — runtime image carries `src/` + `node_modules` + `package.json`; `wget` matches dev-tracker; `start-period=5s` matches the "GET /health within 5 seconds" cold-start budget.

### `docker-compose.yml` (new)

```yaml
services:
  ai-api:
    build:
      context: .
      dockerfile: Dockerfile
    image: ai-api:local
    container_name: ai-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: 3000
      AI_API_HOST: 127.0.0.1
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
```

Host-binds loopback only per spec. `env_file: .env` matches Hermes pattern (BWS → `.env` → compose). No Postgres sidecar — out of scope.

### `.dockerignore` (new)

```
node_modules/ coverage/ *.tsbuildinfo
.git/ .gitignore/ .gitattributes/
.knowledge/ openspec/
.env .env.local .env.*.local
Dockerfile docker-compose.yml .dockerignore
.vscode/ .idea/ .DS_Store *.swp
src/**/*.test.ts tests/ **/*.test.ts
```

Excludes tests, OKF bundle, secrets, and Docker files from build context.

### `.env.example` (modify, +5 / −1 LOC)

Replace `DATABASE_URL` line with:

```
# Auth — required for /v1/* routes. Generate with: openssl rand -hex 32
AI_API_KEY=
# Bind address — loopback by default. Set AI_API_ALLOW_PUBLIC=true to expose publicly.
AI_API_HOST=127.0.0.1
AI_API_ALLOW_PUBLIC=false
```

Keep `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `PORT`, `LOG_LEVEL`, `NODE_ENV`.

### `AGENTS.md` (modify)

Replace Quick Start with `docker compose up -d` as the primary path; keep `pnpm dev` for hot-reload.

## Data Model

No new persistent data. `InMemoryUserRepository` retains its `Map<number, User>`. `AI_API_KEY` is read from `process.env` at request time (env is immutable during a request lifecycle; ~µs cost).

## API Surface

**New.** `Authorization: Bearer ***` header on every `/v1/*` request; 401 envelope `{ "error": { "type": "invalid_request_error", "message": "Missing or invalid API key" } }` (or `"Invalid API key"` for wrong-token).

**Changed.** `POST /v1/chat/completions` JSON `model` field is no longer ignored — response `model` echoes the client-supplied value (or falls back to `'openrouter/free'` when omitted). SSE `model` field per chunk also echoes.

**Unchanged.** `GET /health` (no auth, still returns adapter status), `GET /v1/models`, `OPTIONS *` (still CORS preflight), legacy `/chat`, `/users/*`.

## Testing Strategy

Strict TDD per `openspec/config.yaml` `strict_tdd: true`. Tests co-locate with source (`*.test.ts`). Two new test files, 10 tests total:

| File | # | Name | Spec source | Asserts |
|------|---|------|-------------|---------|
| `src/modules/ai-balancer/interface/routes/openai-chat.route.test.ts` | 1 | non-streaming JSON echoes client model | `openai-route-contract` Non-Streaming Response Shape | 200, `object:"chat.completion"`, `model==="llama-3.1-8b"`, usage zeros present |
| (same) | 2 | SSE terminates with `data: [DONE]\n\n` | `openai-route-contract` Streaming SSE Shape | 200, `content-type: text/event-stream`, body ends `/data: \[DONE\]\n\n$/` |
| (same) | 3 | empty `messages` → 400 | `openai-route-contract` Chat Completions Request | 400, `error.type==="invalid_request_error"` |
| (same) | 4 | 65 messages → 400 | (same) | 400 |
| `src/__tests__/auth-middleware.test.ts` | 5 | `GET /health` no auth → 200 | `v1-auth` Auth-Exempt Paths | 200, no 401 |
| (same) | 6 | `OPTIONS /v1/chat/completions` no auth → CORS 2xx | (same) | 2xx, `access-control-allow-origin: *` |
| (same) | 7 | `POST /v1/chat/completions` no Bearer → 401 envelope | `v1-auth` Bearer Required on /v1/* | 401, OpenAI envelope |
| (same) | 8 | wrong Bearer → 401 | (same) | 401, same envelope |
| (same) | 9 | correct Bearer → 2xx | (same) | 200 (stub service) |
| (same) | 10 | 401 body never contains `AI_API_KEY` value | `v1-auth` No Key Leakage | key string absent |

Tests #1-#4 + #7-#10 = "6-test suite (4 route + 2 auth)"; #5-#6 = "2 build-app cases".

### RED → GREEN → REFACTOR sequence

Write test → WATCH FAIL → minimum code to pass → refactor.

1. **`v1-auth` #7.** Add test: `POST /v1/chat/completions` no auth → 401. **FAIL** (no middleware → 200/404). **GREEN** by creating `auth.ts` + installing in `app.ts`.
2. **`v1-auth` #8.** Wrong Bearer → 401. **FAIL** (presence-only check). **GREEN** by adding `timingSafeEqual` + length pre-check.
3. **`v1-auth` #5.** `GET /health` no auth → 200. **FAIL** (no exempt list). **GREEN** by adding `exemptPathPrefixes`.
4. **`v1-auth` #6.** `OPTIONS /v1/chat/completions` → 2xx CORS. **FAIL**. **GREEN** by adding `exemptMethods`.
5. **`v1-auth` #9 + #10.** Correct Bearer + no-key-leak. **GREEN**; **REFACTOR** extracting error-envelope helper.
6. **`openai-route-contract` #1.** JSON envelope asserts `model===clientModel`. **FAIL** (hardcoded `'openrouter/free'`). **GREEN** by changing `handleOpenAIChat` to read `parsed.data.model`.
7. **`openai-route-contract` #2.** SSE `[DONE]`. **GREEN immediately** (current code correct).
8. **`openai-route-contract` #3 + #4.** 400 empty + 400 oversized. Likely **no-op GREEN** (Zod `.min(1).max(64)` already correct).
9. **`api-runtime` — no unit test.** Loopback bind + `AI_API_KEY` startup-fail exercised at deploy time.
10. **`deployment-v1-0` — no unit test.** Smoke: `docker compose up -d` → `curl localhost:3000/health` → `docker kill` → verify restart.

After all: `pnpm test:run` shows 80+ tests (70 baseline + 10 new), zero regressions.

## Deployment

```bash
cd /home/hermes/projects/ai-api
cp .env.example .env  # fill AI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
docker compose build && docker compose up -d
docker compose ps  # verify State: healthy (≤5s)
curl http://127.0.0.1:3000/health
# expect {"status":"ok","services":[{"name":"Groq"},...]}
curl -X POST http://127.0.0.1:3000/v1/chat/completions \
  -H "Authorization: Bearer $(grep ^AI_API_KEY= .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.1-8b","messages":[{"role":"user","content":"hi"}]}'
# expect 200 with model:"llama-3.1-8b"
curl -X POST http://127.0.0.1:3000/v1/chat/completions -d '{}' -H 'Content-Type: application/json'
# expect 401 envelope
```

**Rollback** (per proposal §Rollback): `docker compose down && git revert <merge-commit>`. If revert missed Docker files: `rm -f Dockerfile docker-compose.yml .dockerignore`. No data loss — InMemory only.

## Risks

| Risk | Mitigation |
|------|------------|
| Public-bind without key = quota-drain | `AI_API_ALLOW_PUBLIC` guard + `AI_API_KEY` required at boot + middleware enforces auth at request time regardless of bind |
| `timingSafeEqual` throws on length mismatch | Explicit `a.length !== b.length` short-circuit; matches Node docs |
| `corepack enable` fails in `node:26-slim` | Fallback: `npm i -g pnpm@11.9.0` in runtime stage; mirrors dev-tracker |
| Hermes-side config not applied | Explicit user-action item below; orchestrator surfaces it |
| Hono middleware ordering regression | Tests #5 + #6 lock the contract |
| OpenAI client sends `tools` field | Silently dropped at Zod per spec; no 400 |
| Mid-stream provider 429 | Out of scope; surfaces as aborted SSE; follow-up change |

## Hermes-Side Action Item (OUT OF SCOPE — user action)

After `docker compose up -d` reports `healthy`, the user must edit `~/.hermes/config.yaml`:

```yaml
model:
  base_url: http://127.0.0.1:3000/v1
  api_key: <same AI_API_KEY value from ai-api/.env>
  provider: openai-compatible
```

The `AI_API_KEY` value must match the one in `/home/hermes/projects/ai-api/.env`. BWS storage alongside `GROQ_API_KEY` / `OPENROUTER_API_KEY` is recommended so the key can be injected into both ai-api's compose env and hermes's runtime env from one source. This lives in hermes config, not the ai-api repo, and is documented here only as an action item the orchestrator surfaces to the user.

## Open Questions

None blocking. `PostgresUserRepository` remains in the codebase unwired; the silent-degrade bug at `src/modules/users/infrastructure/persistence/postgres-user.repository.ts:78-86` is preserved as-is (out of scope per proposal assumption `(d)`). File a follow-up engram observation when Postgres returns in v1.1+.