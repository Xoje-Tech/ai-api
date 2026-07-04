## Exploration: add-nvidia-provider

### Current State
The `ai-api` project acts as a model balancer that currently supports Groq and OpenRouter. It implements an adapter pattern (`AIService`) that streams chat completions using round-robin failover logic. The adapters are located in `src/modules/ai-balancer/infrastructure/adapters/`. `src/index.ts` initializes these services dynamically based on available environment variables.

### Affected Areas
- `package.json` — Add the official `openai` SDK package to dependencies.
- `.env.example` — Document `NVIDIA_API_KEY` for local setups.
- `src/index.ts` — Wire the new adapter into the `services` array of the circuit breaker.
- `src/modules/ai-balancer/infrastructure/adapters/nvidia.adapter.ts` — New adapter file mapping the domain `ChatMessage` to OpenAI/NVIDIA API format.
- `.knowledge/adapters/` — Will be updated automatically upon committing the new adapter via Husky hook.

### Approaches
1. **Direct NVIDIA Adapter using OpenAI SDK** — Create an `nvidia.adapter.ts` utilizing the `openai` Node.js SDK and initializing it with `baseURL: 'https://integrate.api.nvidia.com/v1'` and `apiKey: process.env.NVIDIA_API_KEY`.
   - Pros: Follows existing adapter pattern, utilizes official SDK.
   - Cons: Requires adding a new dependency (`openai`).
   - Effort: Low

### Recommendation
Proceed with Approach 1. The NVIDIA NIM platform provides an OpenAI-compatible API, meaning the `openai` SDK is robust and requires minimal custom logic. We map `ChatMessage` to OpenAI's schema and stream the chunks exactly like the existing OpenRouter adapter.

### Risks
- Network boundaries: The NVIDIA NIM endpoints might exhibit different streaming chunk behavior or rate limits compared to OpenRouter/Groq.
- Dependency bump: Integrating the `openai` SDK increases the application size.

### Ready for Proposal
Yes. The path to add the NVIDIA NIM integration is straightforward and aligns perfectly with the existing adapter architecture.