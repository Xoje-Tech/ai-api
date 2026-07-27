# Tasks: Add NVIDIA NIM Provider

## Phase 1: Setup and Infrastructure
- [x] Task 1.1: Install the `openai` SDK. Run `pnpm add openai`.
- [x] Task 1.2: Add `NVIDIA_API_KEY` to `.env.example` and update environment variable validation to include it.

## Phase 2: Adapter Implementation (TDD)
- [x] Task 2.1: Write unit tests for `NvidiaAdapter` in `src/modules/ai-balancer/infrastructure/adapters/nvidia.adapter.test.ts`. Mock `openai` SDK boundaries.
- [x] Task 2.2: Implement `NvidiaAdapter` in `src/modules/ai-balancer/infrastructure/adapters/nvidia.adapter.ts`. 
  - Ensure it connects to `https://integrate.api.nvidia.com/v1`.
  - Pass `NVIDIA_API_KEY` to the OpenAI client.
  - Implement `streamChat` to map domain `ChatMessage` payload to OpenAI SDK format and yield chunks.
- [x] Task 2.3: Run tests to ensure `nvidia.adapter.ts` passes.

## Phase 3: Registration and Integration
- [x] Task 3.1: Update `src/index.ts` to instantiate `NvidiaAdapter` and register it with the model balancer (alongside Groq and OpenRouter).
- [x] Task 3.2: Verify `GET /health` reports the status of the NVIDIA adapter correctly.
- [x] Task 3.3: Run the full test suite (`pnpm test:run`) to ensure no regressions and verify the CI checks out.