# Specification: Add NVIDIA NIM Provider

## 1. Requirements
1. The model balancer must support NVIDIA NIM as a provider.
2. The implementation MUST use the `openai` npm package.
3. The NVIDIA adapter must connect to `https://integrate.api.nvidia.com/v1`.
4. The adapter must use the `NVIDIA_API_KEY` environment variable for authentication.
5. The adapter must adhere to the existing `AIService` port (like OpenRouter/Groq).
6. The service must be registered in the `services` array in `src/index.ts`.
7. `GET /health` must report the status of the NVIDIA adapter.

## 2. Scenarios

### Scenario 1: Successful stream using NVIDIA NIM
- **Given** an initialized NVIDIA adapter with a valid `NVIDIA_API_KEY`
- **When** `streamChat` is called with a valid `ChatMessage` payload
- **Then** the adapter should yield text chunks matching the underlying OpenAI stream
- **And** the balancer successfully streams the response to the client.

### Scenario 2: Missing API Key
- **Given** the `NVIDIA_API_KEY` is not present in the environment
- **When** the application starts
- **Then** startup will fail loudly (or skip gracefully based on existing strict env initialization rules) if the adapter requires it.

### Scenario 3: NVIDIA API Error
- **Given** the NVIDIA API returns a 5xx error or rate limit (429)
- **When** the balancer routes a request to the NVIDIA adapter
- **Then** the NVIDIA adapter throws an error
- **And** the circuit breaker balancer catches the error and retries with the next available provider.