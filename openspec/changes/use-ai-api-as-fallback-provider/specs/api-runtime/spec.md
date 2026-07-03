# api-runtime Specification

## Purpose

Process lifecycle, network bind policy, liveness, restart behaviour, and database fallback for the ai-api service in fallback-provider mode.

## Requirements

### Requirement: Loopback Bind by Default

The service MUST bind to the host address declared in `AI_API_HOST`, defaulting to `127.0.0.1`. The service MUST refuse to bind to a non-loopback address (e.g. `0.0.0.0`) unless `AI_API_ALLOW_PUBLIC=true` AND `AI_API_KEY` is set.

#### Scenario: Default bind is loopback

- GIVEN `AI_API_HOST` is unset
- WHEN the service starts
- THEN it MUST bind to `127.0.0.1:PORT`

#### Scenario: Public bind refused without key

- GIVEN `AI_API_HOST=0.0.0.0` and `AI_API_KEY` unset
- WHEN the service starts
- THEN it MUST exit non-zero with a configuration error

#### Scenario: Public bind allowed with key

- GIVEN `AI_API_HOST=0.0.0.0`, `AI_API_ALLOW_PUBLIC=true`, and `AI_API_KEY` set
- WHEN the service starts
- THEN it MUST bind to `0.0.0.0:PORT`

### Requirement: Health Endpoint

The service MUST expose `GET /health` returning HTTP 200 with a JSON body that includes per-adapter status. The endpoint MUST NOT require authentication.

#### Scenario: Health reachable without auth

- GIVEN the service is running
- WHEN a client sends `GET /health`
- THEN the response MUST be 200 JSON listing each loaded adapter's status

### Requirement: Restart on Failure

When run under Docker Compose the service MUST be configured with `restart: unless-stopped` so the orchestrator restarts it on any non-zero exit.

#### Scenario: Container restart after crash

- GIVEN the container exited with code 1
- WHEN the Docker daemon polls
- THEN the service MUST restart automatically

### Requirement: InMemory Database Fallback

When `DATABASE_URL` is unset the service MUST wire the `InMemoryUserRepository` and the `/users/*` routes MUST NOT return 5xx for read/write operations.

#### Scenario: Users route works without DATABASE_URL

- GIVEN `DATABASE_URL` unset
- WHEN a client sends `POST /users`
- THEN the response MUST succeed (2xx) using the in-memory store

### Requirement: Refuse to Start Without AI_API_KEY

The service MUST exit non-zero with a clear error at bootstrap if `AI_API_KEY` is unset while any `/v1/*` route is mounted. The error log MUST name the missing variable.

#### Scenario: Start refused when key missing

- GIVEN `AI_API_KEY` unset and `/v1/*` routes registered
- WHEN the service bootstraps
- THEN it MUST exit non-zero and log the missing-variable name
