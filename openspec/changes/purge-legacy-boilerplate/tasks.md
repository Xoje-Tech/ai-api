# Tasks: Purge Legacy Boilerplate

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150-250 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-----------|
| 1 | Purge legacy boilerplate | PR 1 | Base branch; tests/docs included |

## Phase 1: Test Preparation (TDD Setup)

- [x] 1.1 Update `src/__tests__/build-app.test.ts` to assert 404 for `GET /`.
- [x] 1.2 Add test case in `src/__tests__/build-app.test.ts` to assert 404 for `GET /users`.

## Phase 2: Implementation & Cleanup

- [x] 2.1 Delete `src/modules/users/` directory.
- [x] 2.2 Delete `src/modules/shared/interface/views/landing.ts`.
- [x] 2.3 Delete `src/__tests__/users-routes.test.ts`.
- [x] 2.4 Modify `src/app.ts`: remove `users` imports/options, route blocks, and update `exemptPathPrefixes`.
- [x] 2.5 Modify `src/index.ts`: remove `userRepository` wiring.

## Phase 3: Configuration & Dependencies

- [x] 3.1 Modify `vitest.config.ts`: remove `@users` alias.
- [x] 3.2 Modify `tsconfig.json`: remove `@users/*` alias.
- [x] 3.3 Modify `package.json`: remove `"postgres"` dependency.
- [x] 3.4 Run `pnpm install` to clean up dependencies.

## Phase 4: Verification

- [x] 4.1 Run `pnpm typecheck` to verify no lingering references.
- [x] 4.2 Run `pnpm test:run` to verify tests pass and legacy routes return 404.
