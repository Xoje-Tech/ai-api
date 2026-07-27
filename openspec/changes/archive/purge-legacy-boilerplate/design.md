# Design: Purge Legacy Boilerplate

## Technical Approach
We will turn `ai-api` into a pure stateless model balancer by removing the legacy PostgreSQL-backed `/users` CRUD module and the HTML landing view. All traffic to `/` and `/users` will fall back to returning `404 Not Found`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Mount `requireBearer` on `*` and exempt `/` and `/users`** | Slightly longer exempt list in middleware options. | **CHOSEN**. Guarantees that requests to `/` and `/users` bypass auth and return `404 Not Found` (rather than `401 Unauthorized`) for clients without tokens. |
| **Mount `requireBearer` directly on `/v1/*`** | Simplifies exempt list, but leaves other top-level invalid endpoints without timing-safe auth checking. | **REJECTED**. Standard security practice is to have wildcard authentication by default unless explicitly exempted. |
| **Retain `InMemoryUserRepository` stub** | Keeps `BuildAppOptions` footprint but defeats the purge intent. | **REJECTED**. The options should be completely cleaned up to prevent compiling deprecated parameters. |

## Data Flow
All incoming requests that do not match configured routes (`/health`, `/chat`, `/v1/models`, `/v1/chat/completions`) bypass auth (via `exemptPathPrefixes` for `/` and `/users`) or proceed through auth check and then default to the Hono catch-all returning `404 Not Found`.

```
Client ──[Hono App]──► [auth-middleware (Bearer check)] ──► [v1 routes]
           │ (Exempt paths: /, /users, /health, /chat)
           └──► [/] or [/users] ──► 404 Response
```

## Detailed List of Files to Delete
The following 13 files will be deleted entirely from the codebase:
1. `src/modules/shared/interface/views/landing.ts` (HTML landing page view)
2. `src/__tests__/users-routes.test.ts` (Integration tests for user routes)
3. The complete `src/modules/users/` directory:
   - `src/modules/users/interface/routes/users.route.ts` (Hono users sub-router)
   - `src/modules/users/interface/dto/create-user.dto.ts` (Zod creation schema)
   - `src/modules/users/domain/entities/user.ts` (User entity type definition)
   - `src/modules/users/domain/ports/user-repository.port.ts` (User repository port interface)
   - `src/modules/users/infrastructure/persistence/postgres-user.repository.ts` (Postgres adapter implementation)
   - `src/modules/users/infrastructure/persistence/in-memory-user.repository.ts` (In-memory adapter implementation)
   - `src/modules/users/application/use-cases/list-users.ts` (List use-case)
   - `src/modules/users/application/use-cases/create-user.ts` (Create use-case)
   - `src/modules/users/application/use-cases/delete-user.ts` (Delete use-case)
   - `src/modules/users/application/use-cases/get-user.ts` (Get use-case)
   - `src/modules/users/application/use-cases/use-cases.test.ts` (Use-case unit tests)

## Code Modification Plans

### 1. `src/app.ts`
- **Imports**: Remove imports of `handleUsers`, `UserRepository`, `InMemoryUserRepository`, `htmlResponse`, and `landingHTML`.
- **Options**: Remove `userRepository` from `BuildAppOptions` and the factory `buildApp` parameters list.
- **Middleware Configuration**: Update the explanatory comment and modify `exemptPathPrefixes` to keep `/` and `/users` so that unauthorized queries still return `404` directly:
  ```typescript
  exemptPathPrefixes: ['/health', '/chat', '/', '/users']
  ```
- **Routing**: Delete the GET matching block for `/` and the sub-router forwarding block for `/users`. Hono will naturally fall through to returning `404 Not Found`.

### 2. `src/index.ts`
- **Imports**: Remove imports of `InMemoryUserRepository` and `UserRepository`.
- **Wiring**: Delete the local instantiation of `userRepository` (lines 74-75).
- **Factory Call**: Call `buildApp` passing only `services` and `balancer`, omitting `userRepository`.

### 3. `vitest.config.ts`
- **Path Aliases**: Remove the `@users` path alias configuration:
  ```typescript
  '@users': path.resolve(__dirname, 'src/modules/users')
  ```

### 4. `tsconfig.json` (Alignment)
- **Path Aliases**: Remove `@users/*` mappings to align with `vitest.config.ts`.

### 5. `package.json`
- **Dependencies**: Remove `"postgres": "^3.4.4"` from the `"dependencies"` block.
- **Regeneration**: Execute `pnpm install` post-modification to clean up `pnpm-lock.yaml`.

### 6. `src/__tests__/build-app.test.ts`
- **Landing Test Case**: Update the test `"serves the landing page at GET /"` to:
  ```typescript
  it('returns 404 for GET /', async () => {
    const app = buildApp({ services: [] });
    const res = await app.request('/');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });
  ```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `tsconfig.json` & alias removal | Validate compilation with `pnpm typecheck` |
| Integration | Hono routing with missing routes | Run `vitest` to verify `GET /` and `/users` routes return `404` |
| Integration | Missing `DATABASE_URL` boot | Verify `src/index.ts` loads and runs test suite successfully |

## Migration / Rollout
No data migration or rollout strategies are needed. This is a pure clean-up.

## Open Questions
None.
