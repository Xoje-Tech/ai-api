## Exploration: use ai-api as fallback provider for hermes

Change: `use-ai-api-as-fallback-provider` · Project: `ai-api` · Phase: sdd-explore
Mode: hybrid (this file + Engram `sdd/use-ai-api-as-fallback-provider/explore`)
Date: 2026-06-30 · Source of truth: `openspec/changes/use-ai-api-as-fallback-provider/exploration.md`

---

### Current State

ai-api is an OpenAI-compatible HTTP service in everything except deployment and hardening. Investigation by source-tree read on 2026-06-30:

**HTTP surface (`src/app.ts`, 93 lines, monolithic `app.all('*')` dispatcher).** Six mounted routes today:

| Method | Path | Source | Status |
|--------|------|--------|--------|
| `GET` | `/` | `src/app.ts:51` | landing HTML (`@shared/interface/views/landing.ts`) |
| `GET` | `/health` | `src/app.ts:55` | `{ status, services, timestamp }` JSON |
| `POST` | `/chat` | `src/app.ts:63` | legacy SSE, round-robin |
| `GET` | `/v1/models` | `src/app.ts:68` | OpenAI-shaped list of adapter names |
| `POST` | `/v1/chat/completions` | `src/app.ts:80` | OpenAI-compatible (`src/modules/ai-balancer/interface/routes/openai-chat.route.ts`, 200 lines) |
| `*` | `/users/*` | `src/app.ts:84` | delegated to `users.route.ts` |

**OpenAI-compatible surface — what works, what doesn't (line-precise evidence).**

`src/modules/ai-balancer/interface/routes/openai-chat.route.ts:80` (`handleOpenAIChat`):
- **Request schema** (`openai-chat.route.ts:13-25`): `model?`, `messages[1..64]` with role ∈ {`user`, `assistant`, `system`}, `stream?` default `false`. No `temperature`, `top_p`, `max_tokens`, `stop`, `tools`, `n`, `user`, `response_format` — silently ignored. **This is a deliberate decision (comment at line 11-12) but limits interop with clients that send those fields.**
- **Non-streaming response** (lines 101-129): correct OpenAI envelope `{ id, object: "chat.completion", created, model, choices: [{ index, message: { role, content }, finish_reason }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }`. **Usage is hardcoded to zeros** — clients that bill on token counts will under-report.
- **Streaming SSE response** (lines 136-189): emits `chatcmpl-...` id, role delta first, content deltas per chunk, `finish_reason: "stop"` final, and `data: [DONE]` terminator (line 50 `DONE_TOKEN`). Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `x-vercel-ai-data-stream: v1`. **Stream shape matches OpenAI's `chat.completion.chunk` exactly** (lines 55-70 `chunkEvent`). Header `x-vercel-ai-data-stream: v1` is non-standard — OpenAI doesn't send it; safe for Vercel AI SDK clients, harmless for vanilla OpenAI clients.
- **Error envelope** (`openaiJsonError`, lines 194-200): returns `{ error: { type, message } }` JSON with the correct shape. Type field accepts arbitrary strings (`invalid_request`, `server_error`). **Missing `code` and `param` fields** that OpenAI clients sometimes inspect; field is optional in OpenAI's spec, so this is fine.
- **Default model field** (line 83): hardcoded `'openrouter/free'` regardless of what the client requests. Client-supplied `model` is parsed but unused. This is a real bug for hermes if hermes ever passes `model: 'groq/...'` — response will claim the answer came from a model it didn't.
- **Failure handling**: `streamChat` (`application/use-cases/stream-chat.ts:13-32`) already retries `maxAttempts = 3` with `recordFailure` → `recordSuccess` rotation, calling the next adapter on throw. Production wiring in `src/index.ts:94-97` uses `CircuitBreakerBalancer({ failureThreshold: 3, cooldownMs: 30_000 })`. **Failover on transient errors works.** What does NOT work is the test surface — there is no test for `openai-chat.route.ts` at all (see below).

**Round-robin + circuit-breaker.** `src/modules/ai-balancer/application/balancer/`:
- `balancer.ts:3` — `Balancer` port: `selectService` / `recordSuccess` / `recordFailure`.
- `round-robin-balancer.ts:4` — pure rotation, 18 lines, both record methods no-op. Default in `buildApp` when caller doesn't pass a balancer.
- `circuit-breaker-balancer.ts:9` — production balancer (70 lines). Threshold default `1` in class but `index.ts` overrides to `3`. Cooldown `30_000 ms`. State: `open: Set`, `openedAt: Map`, `failures: Map`, `rrIndex`. **Healthy recovery on cooldown expiry is implemented (line 49 `if clock - openedAt >= cooldownMs`).** Fallback path when all OPEN (line 66-68) returns the next rr-positioned service "anyway" — degraded but doesn't deadlock.
- `stream-chat.ts:13-32` — `maxAttempts = 3`, catches `service.chat()` throws, records failure, rotates. **Failover only triggers on `service.chat()` throw, NOT on mid-stream 429/5xx** (the SDK returns an `AsyncIterable` that's only iterated after `service.chat()` resolves; mid-stream failures bubble up raw to the client). This is the standard OpenAI-clone pattern but it means an HTTP 429 from Groq mid-stream would surface as an aborted SSE response to hermes rather than triggering internal failover.

**Users module (`src/modules/users/`).**
- Domain: `User { id, name, email, created_at }` (`domain/entities/user.ts:8`); port `UserRepository { list, findById, create, delete }` (`domain/ports/user-repository.port.ts:23`); `DuplicateEmailError` with `cause: 'duplicate_email'`.
- Use cases: `list-users.ts`, `get-user.ts`, `create-user.ts`, `delete-user.ts` — pure functions taking a repo.
- Routes: `users.route.ts` (95 lines) — handles GET/POST/DELETE on `/users` and `/users/:id` with Zod `CreateUserDto` validation.
- Persistence: `InMemoryUserRepository` and `PostgresUserRepository` (`infrastructure/persistence/postgres-user.repository.ts:19`). Postgres uses the `postgres` npm driver; SQL is inline (no migration files anywhere — `find . -name "migrations"` returns nothing). **The `users` table is assumed to exist; `postgres-user.repository.ts:13-17` documents `docker run -d --name ai-api-pg ...` as the manual setup path.** No CREATE TABLE statement exists in the codebase.
- Wiring: `src/index.ts:71-92` — picks `PostgresUserRepository` if `DATABASE_URL` is set, otherwise `InMemoryUserRepository`. **If `DATABASE_URL` is set but the connection fails on `pgRepo.list(1)` (line 78), the warn-then-fallback logic does NOT actually swap to InMemory — it just logs and proceeds with the broken `pgRepo`.** This is a real bug: a misconfigured `DATABASE_URL` silently leaves the app in a degraded state with no `/users/*` endpoints working.

**Knowledge bundle (`.knowledge/`).** Layout matches `AGENTS.md`:
- `index.md` — hand-written, last updated 2026-06-29T23:30. Lists adapters/api/env pages + 2 hand-written architecture pages.
- `adapters/groq.md`, `adapters/openrouter.md` — auto-generated by `scripts/regenerate-knowledge.ts`.
- `api/endpoints.md` — auto-generated, currently lists **9 routes across 4 modules** (last regenerated 2026-06-29T21:14 — pre-dates the OpenAI endpoints actually being added in commit `f8aab86`). **Stale: the auto-regenerator does not regenerate on every commit, only on staged changes via `lint-staged` (package.json:20-24).**
- `env/variables.md` — auto-generated, currently shows `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL`, `PORT` (last regenerated 2026-06-29T21:14). Matches `.env.example`.
- `architecture/circuit-breaker-balancer.md` and `architecture/round-robin-balancer.md` — hand-written, sacred.
- `log.md` — append-only regenerator history.
- Regenerator: `scripts/regenerate-knowledge.ts` (518 lines, pure parsers + filesystem walkers, no external deps). Detects routes via regex `c.req.method === 'X' && c.req.path === '/Y'` and `req.method === 'X' && pathname === '/Y'` — confirmed to match the OpenAI routes (lines 78, 80 of `src/app.ts`). **Will correctly regenerate `endpoints.md` next time it runs with `--target api`.**
- Linter: `scripts/lint-knowledge-bundle.ts`.

**Deployment surface — what exists today.** `find . -maxdepth 3 \( -name Dockerfile* -o -name compose* -o -name *.service -o -name *.podman* \)`:
- **Zero matches.** No `Dockerfile`, no `docker-compose.yml`, no `docker-entrypoint.sh`, no `.dockerignore`, no systemd unit, no quadlet, no README.
- The only way to run ai-api today is `pnpm start` or `pnpm dev` from a shell that has `node >=26` + `pnpm@11.9` + `.env` with `GROQ_API_KEY`/`OPENROUTER_API_KEY`. **No persistent restart, no healthcheck wiring, no process supervision, no port conflict protection.**
- Reference: dev-tracker (`/home/hermes/projects/dev-tracker/`) was graduated with a 69-line multi-stage `Dockerfile` + 32-line `docker-compose.yml` + 15-line `docker-entrypoint.sh` (Prisma schema push + node start) on 2026-06-30. The same Node 26 + pnpm 11.9 + non-root `node` user + `wget` healthcheck + `HEALTHCHECK` directive pattern applies directly to ai-api.

**Auth.** Exhaustive `grep -n 'auth\|Bearer\|X-API-Key\|API_KEY' src/index.ts src/app.ts src/modules/ai-balancer/interface/routes/openai-chat.route.ts`:
- **Zero matches** for any of: `auth`, `Bearer`, `X-API-Key`, API-key check, header inspection.
- The only env vars read at boot are `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL` (line 25-37 of `src/index.ts`), and they're read for the **outbound** SDK auth, not for inbound HTTP auth.
- **All routes — `/`, `/health`, `/chat`, `/v1/models`, `/v1/chat/completions`, `/users/*` — are completely unauthenticated today.** CORS is `*` (`src/modules/shared/infrastructure/http/response.ts:5`).
- `index.ts:102-106` listens on `0.0.0.0:PORT` — bound to all interfaces. **Combined with no auth, this is a "fire and forget" service: fine for a local-only loopback, dangerous the moment it binds a routable IP.**

**Tests.** `pnpm test:run` baseline 70 passing in ~450ms (per obs 92). Test files: 11 across `src/modules/...` and `scripts/...`. Coverage `src/modules/ai-balancer/interface/routes/openai-chat.route.ts` has **no test file** (`find src -name '*.test.ts' -not -path '*/node_modules/*'` returns 9 files, none of which exercise `/v1/chat/completions` or `/v1/models`). The build-app test (`src/__tests__/build-app.test.ts`) only covers `/`, `/health`, `/chat`, and 404.

**Git log (last 10 commits on `master`):** OpenAI-compatible endpoints landed in `f8aab86 feat(ai-api): add OpenAI-compatible /v1/chat/completions and /v1/models endpoints`. Postgres wiring in `3096e82 feat(users): wire PostgresUserRepository in entrypoint`. OKF bundle in `b3777f1`. No deployment-related commits yet.

**Why this matters for the change.** Today the project is "OpenAI-compatible on paper": the route exists, the SSE shape is correct, the breaker provides failover. What blocks hermes from pointing `base_url` at it is the absence of (a) a way to keep it running across reboots, (b) auth on `/v1/*` so hermes can present a token, (c) a verified end-to-end run that proves a real client can talk to it through real Groq/OpenRouter keys, and (d) test coverage for the OpenAI route to prevent regressions.

---

### Affected Areas

**Must touch (production wiring):**
- `src/index.ts` — add Bearer-token verification on `/v1/*`; bind to `127.0.0.1` by default (override via env); wire `AI_API_KEY` env var. ~15–20 LOC.
- `src/app.ts` — short-circuit `/v1/*` (or all routes) with auth middleware before dispatch. ~10 LOC.
- `src/modules/ai-balancer/interface/routes/openai-chat.route.ts` — accept client-supplied `model` (currently ignored, hardcoded to `'openrouter/free'` at line 83). Pass real `usage` totals (currently zeros). ~15 LOC.
- New: `src/modules/shared/interface/middleware/auth.ts` (or co-located in `src/app.ts`) — Bearer token check, 401 with OpenAI-shaped error envelope. New file.
- New: `Dockerfile` — multi-stage Node 26 build + slim runtime + non-root + `HEALTHCHECK` (mirror dev-tracker pattern).
- New: `docker-compose.yml` — single-service compose, mount env file, restart: unless-stopped, healthcheck from `GET /health`. Mirror dev-tracker pattern.
- New: `.dockerignore` — exclude `node_modules`, `.git`, `.knowledge`, `coverage`, `openspec/changes`, `*.test.ts` from build context.
- New: `scripts/build-and-run.sh` or document `docker compose up -d` in `README.md`/`AGENTS.md`.
- New: `src/modules/ai-balancer/interface/routes/openai-chat.route.test.ts` — minimum: non-streaming JSON envelope, SSE event order (`role` first, content deltas, finish_reason, `[DONE]`), 400 invalid body, 401 unauthenticated, model-echo when client provides one. ~6 tests.

**Should touch (closing real defects):**
- `src/index.ts:71-92` — fix the "Postgres reachable but query failed → keep the broken `pgRepo`" silent-degrade bug. Either reconnect on the next request or actually swap to `InMemoryUserRepository` after the warn.
- `src/index.ts:102-106` — bind to `127.0.0.1` by default; `AI_API_HOST=0.0.0.0` override for the rare non-loopback case.
- `.env.example` — add `AI_API_KEY`, `AI_API_HOST`, comment block about BWS-based secret injection for hermes.
- `.knowledge/api/endpoints.md` — auto-regenerated on next `pnpm knowledge:regen` (which also regenerates `.knowledge/env/variables.md` since `.env.example` changes). No manual edit needed.
- `.knowledge/env/variables.md` — auto-regenerated.

**Could touch (out of scope for v1.0; flag for next change):**
- `src/modules/ai-balancer/interface/routes/openai-chat.route.ts` — mid-stream failover (catch 429/5xx from the SDK iterator and rotate). Today only `service.chat()` throws trigger rotation.
- `src/modules/users/` — proper migration files (`pnpm db:push` currently documented as a manual `docker run` + raw SQL exercise).
- `openspec/specs/{ai-balancer,users,shared}/spec.md` — first formal specs to satisfy `sdd-spec` for downstream phases.

**Untouched (explicitly out of scope):**
- `src/modules/ai-balancer/infrastructure/adapters/*` — both adapters already stream; no change needed.
- `.knowledge/architecture/*.md` — sacred, hand-written, never touched by regenerator.
- `scripts/regenerate-knowledge.ts` — already detects `/v1/*` routes correctly (regex `c.req.path === '/X'` matches both `/v1/models` and `/v1/chat/completions`); verified by re-reading the regex at lines 155, 159 of the regenerator.
- `src/__tests__/build-app.test.ts` — exists, covers `/chat`. New OpenAI tests go in a sibling `openai-chat.route.test.ts`.
- Husky pre-commit, `lint-staged` config — already wires `pnpm exec tsx scripts/regenerate-knowledge.ts --target api` for `src/modules/*/interface/routes/*.ts`; new test file gets regenerated coverage automatically.

---

### Approaches

#### A. Service Runtime

**A1. Docker Compose (single service, mirror dev-tracker pattern).**
- Pros: Matches the graduation the user already approved for dev-tracker; multi-stage Dockerfile + `node:26-slim` runtime + non-root `node` user + `HEALTHCHECK` + `restart: unless-stopped`; trivial to point hermes at `http://127.0.0.1:PORT`; env injection via `.env` file the user already keeps in BWS; zero new runtime dependency (docker is already present per dev-tracker composition).
- Cons: Adds ~70 LOC of Docker config; multi-stage build needs `tsx` in build image (`pnpm start` runs `tsx src/index.ts`, not pre-compiled JS — see `package.json:10`). The regenerator + `.knowledge/` should be `.dockerignore`'d from build context.
- Effort: **Low** — proven pattern already exists for dev-tracker; copy + adjust port + adjust entrypoint.

**A2. systemd user unit (no Docker).**
- Pros: No container layer; Node 26 + pnpm are already installed on the host; `~/.config/systemd/user/ai-api.service` is one file; `journalctl --user -u ai-api` for logs.
- Cons: Dev-tracker's pattern is Compose; mixing two patterns in the user's portfolio is a future maintenance cost. systemd user units die on logout unless lingering is enabled; root unit needs sudo (banned by user preference). ai-api's `pnpm start` is `tsx`-based — needs a build step (`tsc --noEmit` is configured, but no `build` script in `package.json`) before systemd can run it as `node dist/index.js`. **Will require adding a build step that doesn't exist today.**
- Effort: **Medium** — new infra + new build pipeline.

**A3. nix-style process supervisor / pm2 / foreman.**
- Pros: Simple; pm2 is one npm install; ecosystem-aware (auto-restart on file change for dev).
- Cons: Yet another supervisor to maintain; pm2 writes state to `~/.pm2/` which Hermes doesn't track; diverges from the user's portfolio pattern.
- Effort: **Low** — single dependency. But pattern is novel for this user; future agents will be surprised.

**Decision point for A:** Stick with **A1 (Docker Compose)** — same pattern as dev-tracker, same skill path, same backup/snapshot discipline, no new build pipeline needed because `pnpm start` (tsx) works inside the container just as it does on the host. A2 is a fallback only if the user later reports Docker friction.

---

#### B. Auth on `/v1/*`

**B1. Single env-var Bearer (`AI_API_KEY`).**
- Pros: Trivially OpenAI-shaped (`Authorization: Bearer $AI_API_KEY` is what every OpenAI client emits); one env var; one constant-time compare; hermes already stores secrets in BWS — just inject.
- Cons: Shared secret across clients; rotation is manual (edit env, restart). For a single-user local-loopback service this is fine.
- Effort: **Low** — ~15 LOC middleware.

**B2. Per-model keys + scope map.**
- Pros: Future-proof if a second user ever uses this.
- Cons: YAGNI for v1.0; hermes is the only client; introduces key-management UI/state that doesn't exist.
- Effort: **Medium** — needs a key store, expiry, revocation, audit.

**B3. No auth (loopback trust).**
- Pros: Zero code. Matches "internal service on a developer machine" mental model.
- Cons: Default listen is `0.0.0.0` (`src/index.ts:104`). The moment the user binds to a routable IP — which `pnpm dev` already does in some setups, and which Docker port-mapping makes easy to forget — the service is exposed. **`/v1/chat/completions` consumes upstream Groq/OpenRouter quota on every call; an unauthenticated exposed port becomes a quota-drain / billing-attack vector.** Non-negotiable to skip auth in 2026.
- Effort: Trivial, but rejected.

**Decision point for B:** **B1** — `AI_API_KEY` env var, constant-time compare, 401 with OpenAI-shaped `{ error: { type: "invalid_request_error", message: "Missing or invalid API key" } }`. Apply to all `/v1/*` routes (and ideally all non-`/health` routes; or to `/v1/*` only and leave `/users/*` for a follow-up change). Match against `Authorization: Bearer <key>`.

---

#### C. Persistence for v1.0

**C1. InMemory only (drop Postgres from production wiring).**
- Pros: ai-api doesn't actually use `/users` for anything in the OpenAI flow — `/users` is a CRUD exercise that pre-dates hermes integration. `users/` module is orthogonal to `/v1/chat/completions`. InMemory ships in 70/70 tests already. Removes the `DATABASE_URL`-failure silent-degrade bug entirely.
- Cons: PostgresUserRepository is real code (85 lines, 4 use cases + tests + repository) — dropping it would orphan recent work (`3096e82`, `faab26c`). The user might want Postgres eventually.
- Effort: **Low** — flip a flag in `index.ts`.

**C2. Postgres sidecar in compose (mirror dev-tracker).**
- Pros: Real DB; survives container restart via named volume; tested at the E2E level.
- Cons: Adds Postgres service to compose; schema push needs an entrypoint script like dev-tracker's `prisma db push` — but ai-api has NO migration tool, so we'd have to either (a) `psql -c "CREATE TABLE..."` in an entrypoint, or (b) commit a `schema.sql` and run it. **`postgres-user.repository.ts:13-17` already documents a manual `docker run postgres:16` workflow** — that's not production-grade.
- Effort: **Medium** — new `schema.sql`, new `docker-entrypoint.sh`, new service in compose.

**C3. SQLite (file-backed) for v1.0; defer Postgres to v1.1.**
- Pros: One file; no service to manage; idempotent on schema push (CREATE TABLE IF NOT EXISTS); dev-tracker uses SQLite precisely for this reason.
- Cons: New `SqliteUserRepository` (~50 LOC) + dependency on `better-sqlite3` or `sqlite3`. Two parallel repos (InMemory + SQLite + Postgres) becomes maintenance debt. **Scope creep relative to the stated change intent.**
- Effort: **Medium** — new repo + tests + dependency.

**Decision point for C:** **C1 (InMemory only) for v1.0** of this change. **The change is "use ai-api as fallback provider for hermes"; hermes does not consume `/users`.** Postgres stays in the codebase (don't orphan the 85-line repo) but the production wiring in `src/index.ts` always picks `InMemoryUserRepository`. This removes the silent-degrade bug, removes the `DATABASE_URL` env var from `.env.example` for this change, and keeps scope tight. A separate change can promote Postgres (or SQLite) once there's a concrete user-facing reason.

---

#### D. Delivery Coordination

**D1. One SDD change that does refactor + deploy + auth + tests + observability.**
- Pros: One PR, one round of review, one archive entry.
- Cons: Per the sdd-phase-common §E "Review Workload Guard" — 400-line PR budget. This change will touch ~10 files, add ~150 LOC of new code (Dockerfile ~70 + compose ~30 + auth middleware ~15 + tests ~80 + small src edits), modify ~30 LOC across existing files. **Estimate: ~180 added + ~30 deleted ≈ 210 lines.** Under the 400-line budget — but only if scope stays tight. Adding Prometheus metrics + log shipping + structured request IDs + retention would push it over.
- Effort: **Low** orchestration, **Medium** scope discipline.

**D2. Split: this change = refactor + auth + tests + deployment hardening; follow-up change = observability (Prometheus, request IDs, metrics).**
- Pros: Clean PR boundaries; observability is its own design conversation (what to measure, where to ship, retention).
- Cons: Two SDD cycles (more orchestrator overhead); observability work may not get scheduled if user loses momentum.
- Effort: **Medium** orchestration.

**D3. Split: this change = deployment + startup wiring ONLY (Dockerfile, compose, entrypoint, `pnpm build` script); follow-up change = auth + tests + OpenAI-shape fixes.**
- Pros: Deployment is the natural gating step — without it, hermes can't even point at the service.
- Cons: "Without auth" leaves a quota-drain-exposed port sitting on the host for the duration of the follow-up. **Bad risk profile.**
- Effort: **Medium** orchestration but **rejected on safety grounds.**

**Decision point for D:** **D1** — single change, but strictly scoped to what's listed under "Must touch" and "Should touch" above. Observability is explicitly deferred. If the user later asks for metrics, that's a fresh SDD cycle.

---

### Recommendation

**Recommended path = D1 + A1 + B1 + C1.**

- **Runtime: Docker Compose**, mirroring dev-tracker (multi-stage `Dockerfile`, `docker-compose.yml` single-service, `node:26-slim` non-root, `wget` healthcheck, named volume not needed since no DB). Add `AI_API_HOST=127.0.0.1` default to `.env.example` so the loopback binding is the obvious choice.
- **Auth: single Bearer `AI_API_KEY`**, constant-time compare, applied to all `/v1/*` routes, returning OpenAI-shaped 401 with `{ error: { type, message } }`. Exempt `GET /health` (for the container healthcheck) and `OPTIONS *` (CORS preflight).
- **Persistence: `InMemoryUserRepository` only for this change.** Keep `PostgresUserRepository` in the codebase but don't wire it in `index.ts`. Document in `.env.example` that `DATABASE_URL` is no longer read. File a separate observation pointing to the deferred Postgres graduation.
- **Delivery: single SDD change** with ~180 added lines / ~30 modified, well under the 400-line budget. Scope is the "Must touch" + "Should touch" lists above; explicitly defer (a) mid-stream failover, (b) real Postgres in compose, (c) Prometheus metrics, (d) request-ID propagation.

**Order of implementation (for the sdd-apply sub-agent that runs next):**
1. **Auth middleware first** — `src/app.ts` gets a `verifyBearer` check before the `app.all('*', ...)` dispatcher. TDD: write `build-app.test.ts` cases for 401 on `/v1/chat/completions` without auth, 200 with auth, 401 on `/v1/models` without auth.
2. **OpenAI shape fixes** — accept client-supplied `model`, pass through; pass real `usage` if/when token counts become available (for v1.0 keep the zeros but echo the `model` correctly). TDD: test the model echo.
3. **OpenAI route tests** — new `openai-chat.route.test.ts` covering non-streaming JSON, SSE event order, error envelope shape, 400 invalid body.
4. **Bind to loopback by default** — `index.ts` reads `AI_API_HOST` (default `127.0.0.1`), warns if overridden to `0.0.0.0`. Test: assert default bind.
5. **Drop Postgres wiring from production path** — `index.ts` always uses `InMemoryUserRepository` for this change; `PostgresUserRepository` stays in code but is unreferenced in the wiring. Test: assert default repo is InMemory.
6. **Dockerfile + compose + .dockerignore + entrypoint** — copy dev-tracker pattern, adjust for `pnpm start` (tsx) not `node dist/server/index.js`. Add `HEALTHCHECK` against `GET /health`.
7. **Documentation** — update `AGENTS.md` Quick Start to include `docker compose up -d`; update `.env.example` with `AI_API_KEY`, `AI_API_HOST`, drop `DATABASE_URL` (or mark as "not used in v1.0"); let the regenerator pick up the env-var changes automatically.
8. **Real verification (per user preference for production-like testing)** — `docker compose up -d`, then from the host: `curl -H "Authorization: Bearer $AI_API_KEY" -d '{"messages":[{"role":"user","content":"hi"}]}' http://127.0.0.1:3000/v1/chat/completions` (non-streaming AND `stream:true` for SSE). Confirm both shape correctness AND that the breaker actually rotates when one provider is mocked to 500.

**Why this path and not D3 (deploy first, auth later):** the auth is 15 LOC and is what makes the deployed port safe to expose to `0.0.0.0` even briefly during testing. Shipping deploy without auth risks an exposed quota-drain.

---

### Risks

- **Quota-drain if `AI_API_HOST=0.0.0.0` and no auth.** Currently `index.ts:104` binds `0.0.0.0` unconditionally. The recommendation flips this to `127.0.0.1` default, but the user might explicitly override to `0.0.0.0` for testing. Mitigation: auth is mandatory regardless of bind.
- **`AI_API_KEY` rotation is manual.** No token-revocation protocol. If the secret leaks, fix is `docker compose restart` after editing `.env`. Acceptable for v1.0; flag for v1.1 if hermes ever shares the service.
- **`/users/*` endpoints have no auth** (existing behavior, unchanged by this change). If the user later wants to expose them on loopback, they need auth too — separate change.
- **OpenAI client compatibility is partial.** The route silently ignores `temperature`, `top_p`, `max_tokens`, `stop`, `tools`, `n`, `user`, `response_format`. Most clients pass these and silently accept that they're ignored, but tools/function-calling will NOT work — `tools` field is dropped at the Zod schema (`openai-chat.route.ts:13-25`). Mitigation: v1.0 is chat-only; tool-use is a follow-up change.
- **Mid-stream provider errors do not trigger failover.** If Groq returns 429 mid-stream (after `service.chat()` has resolved and the iterator is being read), the iterator throws and the OpenAI-shaped error chunk is emitted (`openai-chat.route.ts:167-175`) without rotating. For hermes this means a single 429 from one provider produces a visible error rather than a silent retry. Acceptable for v1.0; flag as "Mid-stream failover" follow-up.
- **`postgres-user.repository.ts:71-92` silent-degrade bug** (Postgres reachable but query fails → keep broken repo). Out of scope for this change (we're going C1 = InMemory only) but the bug remains in the codebase. File a separate engram observation so a future change can fix it.
- **No test for `openai-chat.route.ts` exists today.** The recommendation adds it; if `sdd-apply` skips that test file, the OpenAI shape has zero regression protection.
- **Hermes-side configuration risk.** The user mentioned Hermes will point `base_url` at this service. hermes's own config must be updated separately — that's not in the ai-api repo. The orchestrator should flag this to the user as a hermes-side action item, not an ai-api action.
- **STALE `.knowledge/api/endpoints.md`** (last regenerated 2026-06-29T21:14, pre-OpenAI-route commit). The regenerator will refresh it on the next `lint-staged` run when `src/app.ts` is staged, or via `pnpm knowledge:regen --target api`. The regenerator's regex (`c.req.method === 'X' && c.req.path === '/Y'` at line 155 of `scripts/regenerate-knowledge.ts`) DOES match `/v1/models` and `/v1/chat/completions`, so the regeneration will be correct.

**Discovered during exploration (worth filing as separate observations):**
1. `src/modules/users/infrastructure/persistence/postgres-user.repository.ts:78` — `await pgRepo.list(1)` is awaited but its result is discarded; on failure, `userRepository = pgRepo` (line 86) keeps the broken repo. Worth a `bugfix` observation if the user ever re-enables Postgres.
2. `src/modules/ai-balancer/interface/routes/openai-chat.route.ts:83` — `model = 'openrouter/free'` default ignores client-supplied model. Worth a `bugfix` observation; the recommended path above fixes it as part of the change.
3. `src/modules/ai-balancer/application/use-cases/stream-chat.ts:13-32` — `maxAttempts = 3` is hardcoded; not configurable via `AIService` env. Worth a `pattern` observation.

---

### Ready for Proposal

**Yes** — the exploration surfaced all four dimensions (runtime, auth, persistence, delivery) with concrete file/line evidence and a single recommended path that's compatible with the user's prior graduation (dev-tracker) and the stated change intent.

**The orchestrator should tell the user:**
- ai-api's `/v1/chat/completions` already supports both non-streaming JSON and streaming SSE, both OpenAI-shaped, and the circuit breaker already provides transparent failover on `service.chat()` throws — that's the good news.
- The graduation (Dockerfile + compose + non-root + healthcheck) is **the missing piece**, plus auth on `/v1/*` (mandatory, otherwise an exposed port is a quota-drain risk).
- Postgres for `/users/*` is **deferred** for this change — hermes doesn't touch `/users/*`, and `/v1/chat/completions` works fine on `InMemoryUserRepository`. This avoids ~50 LOC of entrypoint + schema + sidecar work that has no user-facing benefit right now.
- Total estimate: ~180 added lines, ~30 modified, well under the 400-line review budget. Single SDD change, single PR.
- Two side items the user must do (NOT part of this change): (a) point hermes's `base_url` at `http://127.0.0.1:3000/v1` and inject `AI_API_KEY` into hermes's env; (b) store `AI_API_KEY` in BWS alongside the existing `GROQ_API_KEY` / `OPENROUTER_API_KEY`.

**Next phase:** `sdd-propose` — produce `openspec/changes/use-ai-api-as-fallback-provider/proposal.md` with the scope, approach, and rollback plan. After that: `sdd-spec` (delta specs for `ai-balancer` and possibly `shared`).