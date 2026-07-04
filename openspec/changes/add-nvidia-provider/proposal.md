# Proposal: Add NVIDIA NIM Provider

## Intent
Add NVIDIA NIM as a supported AI provider in the model balancer to increase redundancy and throughput for the round-robin logic. NVIDIA offers an OpenAI-compatible API, allowing us to use the standard OpenAI Node.js SDK to implement the adapter seamlessly.

## Scope

### In Scope
- Install the `openai` SDK package.
- Create `nvidia.adapter.ts` in the AI balancer infrastructure layer.
- Update `src/index.ts` to register the NVIDIA service.
- Require `NVIDIA_API_KEY` for the adapter to load successfully.

### Out of Scope
- Changing the balancer algorithm (remaining round-robin).
- Support for non-chat NVIDIA models (e.g., vision or audio).

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach
Create `src/modules/ai-balancer/infrastructure/adapters/nvidia.adapter.ts`. The adapter will instantiate an OpenAI client with `baseURL: 'https://integrate.api.nvidia.com/v1'` and proxy the `chat` method mapping `ChatMessage` to OpenAI's schema. The streamed response will yield text deltas. The new adapter is injected into `CircuitBreakerBalancer` in `src/index.ts`.

## Affected Areas
- `package.json` — Modified
- `src/index.ts` — Modified
- `src/modules/ai-balancer/infrastructure/adapters/nvidia.adapter.ts` — New
- `.env.example` — Modified

## Risks
- NVIDIA stream chunk payloads might occasionally differ from standard OpenAI, potentially throwing unhandled parsing exceptions. (Likelihood: Low)
- **Mitigation:** Rely on the `openai` SDK to handle network chunking and robustly extract the `delta?.content`.

## Rollback Plan
Revert the PR. Alternatively, remove `NVIDIA_API_KEY` from the deployment environment variables, causing the balancer to gracefully skip the NVIDIA adapter during initialization.

## Dependencies
- `openai` npm package.
- A valid `NVIDIA_API_KEY` from build.nvidia.com.

## Success Criteria
- [ ] Balancer routes traffic to the NVIDIA NIM endpoint when the service is active.
- [ ] `GET /health` includes NVIDIA in the adapter health status list.
- [ ] Unit tests for `nvidia.adapter.ts` pass, successfully streaming mocked chunks.