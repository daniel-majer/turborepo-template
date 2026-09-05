# syntax=docker/dockerfile:1

# Build from the repository root: docker build -f apps/be/Dockerfile -t be .

# Use the same Node version for builds and runtime; Bun installs dependencies.
FROM node:22-alpine AS node-base
FROM node-base AS tooling
COPY --from=oven/bun:1.3.14-alpine /usr/local/bin/bun /usr/local/bin/bun

# Keep workspace manifests in a shared cacheable stage.
FROM tooling AS manifests
WORKDIR /app

# TODO(template): add a COPY line for each new workspace.
COPY package.json bun.lock ./
COPY apps/be/package.json apps/be/
COPY apps/fe/package.json apps/fe/
COPY packages/api-client/package.json packages/api-client/
COPY packages/migrate/package.json packages/migrate/
COPY packages/ts-config/package.json packages/ts-config/
COPY packages/ui/package.json packages/ui/

# Defer postinstalls until the Prisma schema is available.
FROM manifests AS deps
RUN --mount=type=cache,id=bun-install,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter './apps/be'

# Exclude devDependencies from the runtime image.
FROM manifests AS prod-deps
RUN --mount=type=cache,id=bun-install,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --omit peer --ignore-scripts --filter './apps/be'

# Install only the CLI dependencies used by the migration target.
FROM manifests AS migrate-deps
RUN --mount=type=cache,id=bun-install,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --omit peer --ignore-scripts --filter './packages/migrate' && \
    ./packages/migrate/node_modules/.bin/prisma -v >/dev/null

FROM deps AS build
WORKDIR /app

COPY apps/be apps/be
COPY packages/ts-config packages/ts-config

WORKDIR /app/apps/be
# Generate the gitignored Prisma client before compilation.
RUN bun run db:generate && bun run build

# Short-lived migration tooling; never included in the API runtime.
FROM node-base AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=migrate-deps /app/node_modules node_modules
COPY --from=migrate-deps /app/packages/migrate/node_modules apps/be/node_modules
COPY apps/be/package.json apps/be/prisma.config.ts apps/be/
COPY apps/be/src/database/schema.prisma apps/be/src/database/
COPY apps/be/src/database/migrations apps/be/src/database/migrations
WORKDIR /app/apps/be
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM node-base AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/apps/be/node_modules apps/be/node_modules
COPY --from=build /app/apps/be/dist apps/be/dist
COPY apps/be/package.json apps/be/

WORKDIR /app/apps/be
USER node

# TODO(template): keep this port aligned with apps/be/.env.example.
EXPOSE 3001

CMD ["node", "dist/main.js"]
