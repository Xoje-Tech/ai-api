# Technical Design: Add NVIDIA NIM Provider

## 1. Architecture
We will implement a new adapter, `NvidiaAdapter`, that implements the `AIService` port in the `ai-balancer` module. Because NVIDIA NIM exposes an OpenAI-compatible API, we will use the official `openai` SDK to handle the network transport and chunk parsing.

## 2. Components

### `NvidiaAdapter` (`src/modules/ai-balancer/infrastructure/adapters/nvidia.adapter.ts`)
- **Implements:** `AIService`
- **Dependencies:** `openai` SDK.
- **Initialization:**
  ```typescript
  import OpenAI from 'openai';

  const openai = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1'
  });
  ```
- **Methods:**
  - `getName()`: Returns `'nvidia'`.
  - `streamChat(messages)`: Maps domain `messages` to OpenAI's schema, calls `openai.chat.completions.create({ stream: true, ... })`, and uses an async generator to yield `delta.content`.

### `src/index.ts`
- Modifies the service array initialization to include `new NvidiaAdapter()` if `NVIDIA_API_KEY` is present.

### Environment variables
- Update `.env.example` to include `NVIDIA_API_KEY`.
- Validate `NVIDIA_API_KEY` ensuring it's available for initialization.

## 3. Data Model
No changes to domain models. The adapter purely maps domain models (e.g., `ChatMessage`) to the `openai` SDK's request format (`OpenAI.Chat.ChatCompletionMessageParam`).

## 4. Testing Strategy (TDD)
- **Unit Tests:** `src/modules/ai-balancer/infrastructure/adapters/nvidia.adapter.test.ts`
  - Mock the `openai` SDK boundary to avoid real network requests.
  - Test that `streamChat` correctly maps input messages to OpenAI format.
  - Test that `streamChat` correctly yields chunks from the mocked OpenAI stream.
  - Test error handling when the SDK throws (e.g., rate limits, network failures).
- **Integration/Wiring Test:** Ensure `src/index.ts` successfully adds `nvidia` to the balancer.