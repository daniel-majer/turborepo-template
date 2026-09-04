# be

NestJS backend running on **Fastify** (via `@nestjs/platform-fastify`).

## Setup

Requires Docker (Postgres and Redis run in containers, see `docker-compose.yml`).

```bash
bun install          # also runs `prisma generate`
cp .env.example .env
bun run docker:up    # start postgres + redis and wait until healthy
bun run db:migrate   # apply migrations
bun run dev
```

`.env.test` is committed and used by the test scripts; it points at a separate
Docker stack (`docker-compose.test.yml`, ports 5434 / 6380) so tests never touch
your dev data. Both stacks publish only on `127.0.0.1`. Change the
`name:` values marked `TODO(template)` in both Compose files after cloning; each
checkout on the same Docker host must use a different pair of names.

## Scripts

```bash
bun run dev          # docker:up + start in watch mode
bun run build        # compile to dist/
bun run start        # run compiled app
bun run check-types  # tsc --noEmit
bun run test         # unit tests (vitest)
bun run test:e2e     # e2e + integration tests: starts the test docker stack,
                     # migrates, runs, tears the stack down
bun run test:e2e:watch  # same tests in watch mode (start the stack yourself)
bun run test:cov     # unit tests with coverage
bun run docker:up    # start dev postgres + redis
bun run docker:down  # stop them
bun run docker:test:up    # start the throwaway test stack
bun run docker:test:down  # remove it
bun run db:migrate   # create/apply a migration in dev (prisma migrate dev)
bun run db:deploy    # apply migrations in prod/CI (prisma migrate deploy)
bun run db:migrate:test  # apply migrations to the test database
bun run db:studio    # browse the database
```

## Architecture notes

### Fastify instead of Express

`main.ts` bootstraps the app with `FastifyAdapter`. Fastify listens on `0.0.0.0`
(Express-based middleware won't work — use `@fastify/*` equivalents).

### Environment variables & config (`src/config/`)

- Managed by `@nestjs/config` + validated with a **zod** schema in `src/config/env.ts`.
- `.env` is loaded normally; with `NODE_ENV=test` (set automatically by vitest)
  the app and `prisma.config.ts` load `.env.test` with override semantics
  (`src/config/env-file.ts`), so ambient `DATABASE_URL` / `REDIS_URL` values
  cannot redirect cleanup.
- The app fails fast on startup if a variable is missing or invalid.
- Raw env vars are grouped into typed **namespaces** via `registerAs`
  (`src/config/app.config.ts`) and injected where needed — never use `process.env`:

  ```ts
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}
  this.config.port; // number
  ```

- Adding a variable: declare it in the zod schema (`src/config/env.ts`),
  add it to `.env.example` (`.env` is gitignored), and expose it through an
  existing or new namespace (e.g. `database.config.ts` with
  `registerAs("database", ...)` registered in `CoreModule`'s `load: [...]`).

### Database (`src/database/`)

- **Postgres 17** in Docker, **Prisma 7** with the `pg` driver adapter.
- Schema lives in `src/database/schema.prisma`, migrations in
  `src/database/migrations/`, config in `prisma.config.ts`. The generated client
  (`src/database/generated/`) is gitignored and rebuilt on `bun install`.
- `DatabaseService` extends `PrismaClient`, connects on module init and is
  global — inject it and use `this.db.user.findMany()`.
- Changing the schema: edit `schema.prisma`, then `bun run db:migrate`.
- `docker-compose.yml` reads `POSTGRES_*` and `REDIS_PORT` from `.env`; the app
  itself only reads `DATABASE_URL` and `REDIS_URL`, so keep the ports in sync.
- `docker-compose.test.yml` intentionally contains fixed disposable credentials
  and ports. Keep them aligned with the committed `.env.test` file.

### Cache (`src/cache/`)

- **Redis 7** in Docker, `@nestjs/cache-manager` on top of `cache-manager` v7
  and `@keyv/redis`. Default TTL is 5 s (ms everywhere).
- Use the global `CacheService` (`get`, `set`, `del`, `clear`, `wrap`) rather than
  `CACHE_MANAGER` directly, so the store can be swapped in one place.
  `wrap(key, fn, ttl)` is the cache-aside helper: returns the cached value or
  runs `fn`, stores and returns its result.
- Nest's `CacheInterceptor` is **not** registered globally on purpose — it keys
  by URL only, which leaks responses between users on authenticated routes.
  Apply it per controller with `@UseInterceptors(CacheInterceptor)` on public
  GET endpoints.

### Logging

- `nestjs-pino` — structured JSON logs, `pino-pretty` in development, silent in
  tests. Every request is logged with `authorization`, `cookie` and `set-cookie`
  headers redacted.
- Inject a scoped logger with `@InjectPinoLogger(MyService.name) logger: PinoLogger`.

### Responses

- **`TransformResponseInterceptor`** (`APP_INTERCEPTOR`) wraps every handler
  result as `{ data }`. Return `{ data, meta }` yourself to pass pagination or
  similar through unchanged.
- **Helmet** (`@fastify/helmet`) sets security headers in `main.ts`.

### Global providers (`core.module.ts`)

Registered via DI tokens (`APP_PIPE`, `APP_FILTER`, `APP_INTERCEPTOR`) instead of
`app.useGlobal*()` in `main.ts`, so they also apply in e2e tests and can use
injection.

- **`ValidationPipe`** (`APP_PIPE`) — validates DTOs with `class-validator`;
  `whitelist` + `forbidNonWhitelisted` reject unknown body fields, `transform`
  converts payloads to DTO instances.
- **`AllExceptionsFilter`** (`APP_FILTER`, `src/common/all-exceptions.filter.ts`) —
  unified error responses with `statusCode`, `message`, `timestamp`, `path`.
  `HttpException`s keep their status and message; unknown errors are logged
  with stack trace and returned as a generic 500 (no internals leak to clients).

### Testing

- **Unit** (`src/**/*.spec.ts` and `test/**/*.spec.ts`) — isolated service,
  environment, and cleanup-safety tests; controllers have no logic and their
  decorators, pipes and filters are only exercised end to end. Dependencies are
  auto-mocked with `createMock` from `@golevelup/ts-vitest`
  (`.useMocker(() => createMock())`), which is deep enough for `DatabaseService`
  (`db.user.findMany.mockResolvedValue([])`). Never import `CoreModule` in a
  unit test — it connects to Postgres and Redis.
- **Integration** (`test/*.int-spec.ts`) — real Postgres and Redis, no HTTP:
  exercise a service or `DatabaseService`/`CacheService` directly.
- **E2E** (`test/*.e2e-spec.ts`) — same, but through HTTP via Fastify's
  `app.inject()` (no real port, no supertest); this is where controllers,
  decorators, pipes, filters and interceptors get covered.
- Both use `useTestApp()` from `test/setup.ts`: it boots `AppModule` once per
  file, applies the same `configureApp()` as `main.ts` (helmet, logger), and
  after every test truncates all tables and clears the cache. Pass extra
  `controllers`/`providers` for the test as module metadata. Files run
  sequentially (`fileParallelism: false`) because they share one database.
- Before cleanup, the helper requires `NODE_ENV=test`, exact Postgres and Redis
  URLs from `.env.test`, local hostnames, and a Postgres database ending in
  `_test`.
- `bun run test:e2e` starts `docker-compose.test.yml`, applies migrations and
  removes the stack afterwards, so it needs Docker but no manual setup.

### CI / CD

- The GitHub workflow runs unit tests (`bun x turbo run test`) and e2e
  tests (`bun x turbo run test:e2e`, using the same Docker test stack as locally)
  as separate jobs, only for affected packages on pull requests.
- There is no deploy workflow (it depends on where you host). Whatever you use,
  run `bun run db:deploy` with the production `DATABASE_URL` before starting the
  new version, and build from the repo root because `be` depends on workspace
  packages.
