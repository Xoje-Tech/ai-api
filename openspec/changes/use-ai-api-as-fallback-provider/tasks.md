# Tasks: use-ai-api-as-fallback-provider

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250 (auth+tests ~80, route+tests ~70, Docker ~80, env+docs ~20) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Tests First (RED)

- [ ] 1.1 Create `src/__tests__/auth-middleware.test.ts` — 6 cases: `/health`→200, `OPTIONS`→2xx, POST no Bearer→401 envelope, wrong Bearer→401, correct Bearer→2xx, body lacks `AI_API_KEY` value. Watch RED.
- [ ] 1.2 Create `src/modules/ai-balancer/interface/routes/openai-chat.route.test.ts` — 4 cases: JSON echoes client `model`; SSE ends `data: [DONE]\n\n`; empty/65 messages→400 `invalid_request_error`. Watch RED on #1.

## Phase 2: Auth middleware + app wiring (GREEN)

- [ ] 2.1 Create `src/modules/shared/interface/middleware/auth.ts` exporting `requireBearer(envVar, exemptPathPrefixes, exemptMethods?)` with `timingSafeEqual` + length pre-check, OpenAI-shaped 401 envelope. ~50 LOC.
- [ ] 2.2 Modify `src/app.ts`: insert `app.use('*', requireBearer('AI_API_KEY', ['/health'], ['OPTIONS']))` BEFORE `app.all('*')` dispatcher; keep `/users/*` open. +2 LOC.
- [ ] 2.3 `pnpm test:run` — 6 new auth tests pass; total 76+.
- [ ] 2.4 REFACTOR: extract error-envelope helper; tests stay green.

## Phase 3: OpenAI route fix (GREEN)

- [ ] 3.1 Modify `src/modules/ai-balancer/interface/routes/openai-chat.route.ts` ~L83: replace hardcoded `'openrouter/free'` with `parsed.data.model`. +5/−1 LOC.
- [ ] 3.2 Route tests 4/4 pass; total 80+.

## Phase 4: Bind + startup hardening (GREEN)

- [ ] 4.1 Modify `src/index.ts`: read `AI_API_HOST` (default `127.0.0.1`); pass to `serve({ hostname })` instead of hardcoded `0.0.0.0`.
- [ ] 4.2 Modify `src/index.ts`: drop `DATABASE_URL` branch; always wire `InMemoryUserRepository`.
- [ ] 4.3 Modify `src/index.ts`: throw on boot when `AI_API_KEY` unset (clear message).
- [ ] 4.4 Modify `.env.example`: add `AI_API_KEY=` + `AI_API_HOST=127.0.0.1`; remove `DATABASE_URL`; keep GROQ, OPENROUTER, PORT, NODE_ENV, LOG_LEVEL.
- [ ] 4.5 `pnpm test:run` — zero regressions.

## Phase 5: Dockerfile + compose + dockerignore (GREEN)

- [ ] 5.1 Create `Dockerfile` (multi-stage: builder `node:26`+`pnpm@11.9`; runtime `node:26-slim` non-root+`wget`; HEALTHCHECK wget `/health`; CMD `["pnpm","start"]`). ~30 LOC.
- [ ] 5.2 Create `.dockerignore` — exclude `node_modules`,`.git`,`.atl`,`openspec`,`.env*`,`dist`,`.knowledge/log.md`,`src/**/__tests__/`. ~22 LOC.
- [ ] 5.3 Create `docker-compose.yml` — svc `ai-api`, `127.0.0.1:3000:3000`, `env_file:.env`, `restart:unless-stopped`, healthcheck wget. ~20 LOC.
- [ ] 5.4 Modify `AGENTS.md` Quick Start: replace `pnpm dev` with `docker compose up -d`.

## Phase 6: Smoke verification (manual)

- [ ] 6.1 `docker compose up -d --build`; verify `healthy` ≤5s.
- [ ] 6.2 `curl 127.0.0.1:3000/health` → 200 JSON.
- [ ] 6.3 `curl -X POST 127.0.0.1:3000/v1/chat/completions` (no Bearer) → 401 OpenAI envelope.
- [ ] 6.4 `curl -X POST -H "Authorization: Bearer $AI_API_KEY" -d '{"model":"llama-3.1-8b","messages":[{"role":"user","content":"hi"}]}'` → 200 SSE ending `[DONE]`.
- [ ] 6.5 `docker compose down` — clean shutdown.

## Phase 7: Memory + commit

- [ ] 7.1 `pnpm knowledge:regen` — refresh `.knowledge/api/endpoints.md` + `.knowledge/env/variables.md`.
- [ ] 7.2 `pnpm knowledge:lint` — OKF OK, exit 0.
- [ ] 7.3 `git commit -m "feat(ai-api): graduate to fallback provider: bearer auth + loopback bind + docker compose"` (no Co-Authored-By).
- [ ] 7.4 `git push origin master` (if gh auth OK).

## Out of Scope

- User updates `~/.hermes/config.yaml` `model.{base_url,api_key,provider}` after compose healthy.