# syntax=docker/dockerfile:1.7
FROM node:26-bookworm AS build
WORKDIR /app
RUN npm install -g corepack@latest && corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm typecheck

FROM node:26-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
USER node
ENV NODE_ENV=production PORT=3000 AI_API_HOST=127.0.0.1
EXPOSE 3000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["pnpm", "start"]