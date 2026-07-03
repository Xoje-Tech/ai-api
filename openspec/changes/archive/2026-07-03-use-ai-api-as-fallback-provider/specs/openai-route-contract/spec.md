# openai-route-contract Specification

## Purpose

Request and response shapes for the OpenAI-compatible HTTP surface exposed by ai-api in fallback-provider mode. Chat-completions only; tools/function-calling deferred.

## Requirements

### Requirement: Chat Completions Request

`POST /v1/chat/completions` MUST accept a JSON body with `messages` (array length 1..64, each `role` ∈ `{user, assistant, system}`), `stream` (boolean, default false), and an arbitrary `model` string. The endpoint MUST reject payloads with zero messages or more than 64 messages as 400.

#### Scenario: Empty messages rejected

- GIVEN a request body with `messages: []`
- WHEN the client calls `POST /v1/chat/completions`
- THEN the response MUST be 400

#### Scenario: Too many messages rejected

- GIVEN a request body with 65 messages
- WHEN the client calls `POST /v1/chat/completions`
- THEN the response MUST be 400

### Requirement: Non-Streaming Response Shape

A non-streaming success MUST return an OpenAI-shaped object: `{ id, object: "chat.completion", created, model, choices: [...], usage: { prompt_tokens, completion_tokens, total_tokens } }`. The `model` field MUST echo the value supplied by the client.

#### Scenario: Non-streaming JSON shape

- GIVEN an authed request with `model: "llama-3.1-8b"`
- WHEN the upstream returns successfully
- THEN the response MUST be 200 JSON with `object:"chat.completion"` and `model` equal to the client-supplied value

### Requirement: Streaming SSE Shape

When `stream: true` the response MUST be `text/event-stream` with each chunk carrying an `id` matching `chatcmpl-*` and MUST terminate with a final `data: [DONE]\n\n` frame.

#### Scenario: SSE emits DONE

- GIVEN an authed streaming request
- WHEN the upstream completes
- THEN the response MUST end with `data: [DONE]\n\n`

### Requirement: Models List

`GET /v1/models` MUST return `{ object: "list", data: [...] }` where `data` enumerates the names of every loaded adapter.

#### Scenario: Models list reflects adapters

- GIVEN Groq and OpenRouter adapters are loaded
- WHEN the client calls `GET /v1/models`
- THEN the response MUST be 200 JSON listing both adapter names under `data`

### Requirement: Usage May Be Zero

`usage.prompt_tokens` and `usage.completion_tokens` MAY be `0` in v1.0; clients MUST NOT rely on accurate token accounting in this release.

#### Scenario: Zero usage accepted

- GIVEN a non-streaming success with `usage` zeros
- WHEN the response is parsed
- THEN it MUST still conform to the OpenAI envelope shape

### Requirement: Chat-Only Surface

The `/v1/*` surface MUST reject `tools`, `functions`, and `tool_choice` payloads by dropping them at the Zod schema (no 400 required). Function-calling is explicitly out of scope for v1.0.

#### Scenario: Tools silently dropped

- GIVEN a request body containing `tools: [...]`
- WHEN the client calls `POST /v1/chat/completions`
- THEN the response MUST proceed as a plain chat completion without invoking tools