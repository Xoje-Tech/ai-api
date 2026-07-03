# v1-auth Specification

## Purpose

Bearer-token authentication for the OpenAI-compatible `/v1/*` surface, with OpenAI-shaped 401 errors and exempt paths for health probes and CORS preflight.

## Requirements

### Requirement: Bearer Required on /v1/*

Every request under `/v1/*` MUST carry `Authorization: Bearer <token>`. The token MUST be compared to the configured `AI_API_KEY` using a constant-time check.

#### Scenario: Missing Authorization

- GIVEN no `Authorization` header
- WHEN the client calls `POST /v1/chat/completions`
- THEN the response MUST be 401 with body `{ "error": { "type": "invalid_request_error", "message": "..." } }`

#### Scenario: Wrong Bearer

- GIVEN `Authorization: Bearer <wrong-token>`
- WHEN the client calls `POST /v1/chat/completions`
- THEN the response MUST be 401 with the same OpenAI-shaped error envelope

#### Scenario: Correct Bearer

- GIVEN `Authorization: Bearer <correct-token>`
- WHEN the client calls `POST /v1/chat/completions`
- THEN the response MUST proceed (2xx or upstream 4xx/5xx, never 401)

### Requirement: Auth-Exempt Paths

`GET /health` and `OPTIONS *` MUST bypass Bearer auth so probes and CORS preflight succeed without credentials.

#### Scenario: Health bypasses auth

- GIVEN no Authorization header
- WHEN the client calls `GET /health`
- THEN the response MUST be 200 (no 401)

#### Scenario: OPTIONS preflight bypasses auth

- GIVEN no Authorization header
- WHEN the client sends `OPTIONS /v1/chat/completions`
- THEN the response MUST be 2xx without challenging for credentials

### Requirement: No Key Leakage in Errors

401 responses MUST NOT echo, prefix, or hash the configured `AI_API_KEY` value.

#### Scenario: 401 body contains no key material

- GIVEN any 401 condition
- WHEN the response body is inspected
- THEN the configured `AI_API_KEY` value MUST NOT appear in any field
