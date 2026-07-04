# syntax=docker/dockerfile:1.7
FROM node:26-bookworm AS build
WORKDIR /app
# pnpm 10+ respects CI=true to suppress interactive prompts (e.g. the
# ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY abort that hits a non-TTY
# build). Without this, `pnpm typecheck` aborts because pnpm wants to
# ask whether to purge stale modules from the install step.
ENV CI=true
RUN npm install -g corepack@latest && corepack enable
# pnpm 10+ ignores build scripts unless `onlyBuiltDependencies` is visible.
# pnpm-workspace.yaml carries that config in this repo, so it must be in
# the build context BEFORE `pnpm install` runs (the later COPY . would be
# too late — install reads workspace config first).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm typecheck

FROM node:26-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
USER node
ENV NODE_ENV=production PORT=6789 AI_API_HOST=0.0.0.0
EXPOSE 6789
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/tsconfig.json ./
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:6789/health || exit 1
# The app runs via tsx in production mode.
CMD ["npx", "tsx", "src/index.ts"]