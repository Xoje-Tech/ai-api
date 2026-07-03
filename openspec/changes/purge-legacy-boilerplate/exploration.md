## Exploration: purge-legacy-boilerplate

### Current State
The project currently includes a `users/` module (Postgres-backed) and a `landing.ts` view. These are imported and used in `src/app.ts` and `src/index.ts`. The `ai-balancer` and OpenAI-compatible routes (`/v1/*`) are independent of these components.

### Affected Areas
- `src/modules/users/` — legacy module to be deleted.
- `src/modules/shared/interface/views/landing.ts` — legacy view to be deleted.
- `src/app.ts` — remove imports of `users` and `landingHTML`, remove `userRepository` from `buildApp`, remove `/users` path handling.
- `src/index.ts` — remove `UserRepository` and `InMemoryUserRepository` imports, remove `userRepository` instantiation.
- `src/__tests__/users-routes.test.ts` — remove legacy test file.

### Approaches
1. **Direct Removal** — The components are isolated and have no functional dependency on the core balancer logic. Removing them is straightforward.
   - Pros: Cleans up the codebase, reduces complexity, removes unused dependencies.
   - Cons: None identified.
   - Effort: Low.

### Recommendation
Proceed with Direct Removal. The investigation confirms complete independence of core AI features.

### Risks
- None identified.

### Ready for Proposal
Yes. The orchestrator can inform the user that all legacy components are confirmed isolated and safe to purge.
