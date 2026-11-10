# syntax=docker/dockerfile:1
FROM node:24.13.1-bookworm-slim AS base
ENV COREPACK_HOME=/opt/corepack
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack install

FROM base AS toolchain
# Native modules are installed for the container platform, never from the host.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY scripts/install-hooks.mjs scripts/install-hooks.mjs

FROM toolchain AS dependencies
RUN pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM toolchain AS production-dependencies
RUN pnpm install --prod --frozen-lockfile --store-dir /pnpm/store

FROM docker:28-cli AS docker-cli

# The official image supplies Chromium and its system dependencies. Keep this
# version in sync with @playwright/test in package.json and pnpm-lock.yaml.
FROM mcr.microsoft.com/playwright:v1.65.0-noble AS e2e
# Use the same Node and Corepack as the build, instead of the image's Node.
COPY --from=base /usr/local/ /usr/local/
COPY --from=base /opt/corepack/ /opt/corepack/
ENV COREPACK_HOME=/opt/corepack \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    APP_PREBUILT=true
WORKDIR /app
COPY --from=build /app/ /app/
CMD ["pnpm", "test:e2e:built"]

FROM e2e AS verify
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
CMD ["pnpm", "verify"]

FROM node:24.13.1-bookworm-slim AS smoke
WORKDIR /app
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY scripts/smoke-container.mjs scripts/smoke-container.mjs
CMD ["node", "scripts/smoke-container.mjs"]

FROM node:24.13.1-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/todo.db
WORKDIR /app
COPY --from=production-dependencies /app/node_modules/ ./node_modules/
COPY package.json ./
COPY --from=build /app/dist/ ./dist/
COPY migrations/ ./migrations/
COPY scripts/healthcheck.mjs scripts/smoke-probe.mjs ./scripts/
RUN mkdir data && chown node:node data
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=3 \
    CMD ["node", "scripts/healthcheck.mjs"]
CMD ["node", "dist/server.js"]
