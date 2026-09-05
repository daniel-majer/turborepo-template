# syntax=docker/dockerfile:1

# Build from the repository root: docker build -f apps/fe/Dockerfile -t fe .

# Run Next builds and the standalone server on the same Node version.
FROM node:22-alpine AS node-base
FROM node-base AS tooling
COPY --from=oven/bun:1.3.14-alpine /usr/local/bin/bun /usr/local/bin/bun

# Cache dependency installs separately from source changes.
FROM tooling AS deps
WORKDIR /app

# TODO(template): add a COPY line for each new workspace.
COPY package.json bun.lock ./
COPY apps/be/package.json apps/be/
COPY apps/fe/package.json apps/fe/
COPY packages/api-client/package.json packages/api-client/
COPY packages/ts-config/package.json packages/ts-config/
COPY packages/ui/package.json packages/ui/

# Defer codegen until the sources and API spec are available.
RUN --mount=type=cache,id=bun-install,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter './apps/fe' --filter './packages/*'

FROM deps AS build
WORKDIR /app

COPY apps/fe apps/fe
COPY packages/api-client packages/api-client
COPY packages/ts-config packages/ts-config
COPY packages/ui packages/ui
# Generate the API client from the committed spec.
COPY apps/be/openapi.json apps/be/openapi.json

ENV NEXT_TELEMETRY_DISABLED=1

# Skip build-time validation; instrumentation validates again at startup.
ENV SKIP_ENV_VALIDATION=true

# TODO(template): add an ARG/ENV pair for each build-time public variable.
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# Empty means same origin (a reverse proxy in front of both apps).
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Run Orval from its package directory to use the correct tsconfig.
WORKDIR /app/packages/api-client
RUN bun run generate

WORKDIR /app/apps/fe
RUN bun run build

# Ship only the standalone server and its assets.
FROM node-base AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone server binds localhost by default.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Preserve workspace paths and allow the node user to write Next's cache.
COPY --from=build --chown=node:node /app/apps/fe/.next/standalone ./
# Static and public files are not part of the standalone output.
COPY --from=build --chown=node:node /app/apps/fe/.next/static apps/fe/.next/static
COPY --from=build --chown=node:node /app/apps/fe/public apps/fe/public

USER node

EXPOSE 3000

CMD ["node", "apps/fe/server.js"]
