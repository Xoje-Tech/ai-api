# deployment-v1-0 Specification

## Purpose

Containerized deployment artefacts for the ai-api fallback provider: multi-stage Dockerfile, single-service Compose file, `.dockerignore`, and environment-variable wiring.

## Requirements

### Requirement: Multi-Stage Dockerfile

The repository MUST ship a multi-stage `Dockerfile` with at least one `build` stage and one `runtime` stage. The runtime stage MUST use `node:26-slim`, run as a non-root user, and include `wget` for healthchecks.

#### Scenario: Image is non-root and slim

- GIVEN the image is built
- WHEN the container starts
- THEN the active user MUST be non-root and the base image MUST be `node:26-slim`

### Requirement: Loopback-Only Compose Bind

`docker-compose.yml` MUST publish the service on the host as `127.0.0.1:3000:3000` so the container port is never publicly exposed. The service MUST be the only service defined.

#### Scenario: Compose file binds loopback only

- GIVEN `docker compose up -d`
- WHEN `docker compose ps` is queried
- THEN the published port MUST be `127.0.0.1:3000->3000/tcp` and no other service MUST be defined

### Requirement: In-Container Healthcheck

The Compose service MUST declare a healthcheck that issues `wget --spider http://127.0.0.1:3000/health` inside the container.

#### Scenario: Healthcheck reaches the in-container endpoint

- GIVEN the container is running
- WHEN the healthcheck executes
- THEN it MUST exit 0 only if `GET /health` returns 200

### Requirement: Restart Policy

The Compose service MUST set `restart: unless-stopped`.

#### Scenario: Restart survives crash

- GIVEN the container process exited non-zero
- WHEN the Docker daemon polls
- THEN the service MUST restart automatically

### Requirement: Environment Wiring via .env.example

`.env.example` MUST declare `AI_API_KEY` (no default value), `AI_API_HOST=127.0.0.1`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, and MAY declare `LOG_LEVEL`, `NODE_ENV`, `PORT`. `DATABASE_URL` MUST NOT appear (InMemory-only v1.0).

#### Scenario: Required keys documented

- GIVEN a fresh clone
- WHEN `cp .env.example .env` is run and edited
- THEN the operator MUST be able to set `AI_API_KEY`, `GROQ_API_KEY`, and `OPENROUTER_API_KEY` to start the service

### Requirement: Smoke-Up Health Within 5 Seconds

After `docker compose up -d`, `GET /health` on the host MUST return 200 within 5 seconds.

#### Scenario: Cold-start smoke

- GIVEN a freshly built image and clean Compose state
- WHEN `docker compose up -d` completes and the operator polls `/health`
- THEN the endpoint MUST respond 200 within 5 seconds