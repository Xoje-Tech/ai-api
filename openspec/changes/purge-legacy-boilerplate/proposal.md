# Proposal: Purge Legacy Boilerplate

## Intent
Remove legacy PostgreSQL-backed user CRUD and the HTML landing page to establish `ai-api` as a pure, lightweight, stateless model balancer.

## Scope

### In Scope
- Delete `src/modules/users/` folder.
- Delete `src/modules/shared/interface/views/landing.ts`.
- Delete `src/__tests__/users-routes.test.ts`.
- Modify `src/app.ts` to remove `/users` routes and `BuildAppOptions.userRepository`.
- Modify `src/index.ts` to remove database/userRepository imports and initialization.
- Modify `vitest.config.ts` to purge the `@users` path alias.
- Modify `package.json` to remove the `"postgres"` dependency.
- Update `src/__tests__/build-app.test.ts` (remove the `GET /` HTML test, assert `404` instead).

### Out of Scope
- Modifying core `ai-balancer` logic or model provider integration.
- Changing authentication mechanisms for `/v1/*` endpoints.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `api-endpoints`: Remove the `/users` CRUD endpoints and root `/` landing page, updating both to return 404.

## Approach
- Delete directories and files directly.
- Clean up references in bootstrapping config and type declarations.
- Purge path aliases and third-party DB dependencies.
- Update/delete unit tests that target purged endpoints to match the new 404 behavior.
- Validate via strict typecheck and test suite.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/users/` | Removed | Complete directory deletion |
| `src/modules/shared/interface/views/landing.ts` | Removed | File deletion |
| `src/__tests__/users-routes.test.ts` | Removed | File deletion |
| `src/app.ts` | Modified | Remove routes, imports, options |
| `src/index.ts` | Modified | Remove database bootstrapping |
| `vitest.config.ts` | Modified | Remove `@users` alias |
| `package.json` | Modified | Remove `"postgres"` driver |
| `src/__tests__/build-app.test.ts` | Modified | Update route assertions |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Broken imports across modules | Low | Mitigated by compiler (`pnpm typecheck`) and co-located tests |

## Rollback Plan
Run `git reset --hard HEAD` and `pnpm install` to restore the deleted files and reinstall the `postgres` library.

## Dependencies
None.

## Success Criteria
- [ ] Directory `src/modules/users/` is fully deleted.
- [ ] `postgres` package is removed from `package.json`.
- [ ] `pnpm typecheck` compiles with zero errors.
- [ ] `pnpm test:run` passes.
- [ ] `/` and `/users` routes return `404`.
