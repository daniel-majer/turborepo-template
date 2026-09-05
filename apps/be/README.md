# be

NestJS backend running on **Fastify** (via `@nestjs/platform-fastify`).

## Setup

Requires Docker (Postgres and Redis run in containers, see `docker-compose.yml`).

```bash
bun install          # also runs `prisma generate`
cp .env.example .env
bun run dev          # starts postgres + redis, applies migrations, watch mode
bun run db:seed      # optional: two sample users
```

`dev` chains `docker:up`, `db:deploy` and `nest start --watch`, so a fresh clone
reaches a working schema without a separate step. `db:migrate` is for creating
a migration after editing `schema.prisma`.

`.env.test` is committed and used by the test scripts; it points at a separate
Docker stack (`docker-compose.test.yml`, ports 5434 / 6380) so tests never touch
your dev data. Both stacks publish only on `127.0.0.1`. Change the
`name:` values marked `TODO(template)` in both Compose files after cloning; each
checkout on the same Docker host must use a different pair of names.

## Scripts

```bash
bun run dev          # docker:up + db:deploy + start in watch mode
bun run build        # compile to dist/
bun run start        # run compiled app
bun run check-types  # tsc --noEmit
bun run test         # unit tests (vitest)
bun run test:e2e     # e2e + integration tests: starts the test docker stack,
                     # migrates, runs, tears the stack down
bun run test:e2e:watch  # same tests in watch mode; start the stack and
                     # migrate it yourself first (see below)
bun run test:cov     # unit tests with coverage
bun run docker:up    # start dev postgres + redis
bun run docker:down  # stop them
bun run docker:test:up    # start the throwaway test stack
bun run docker:test:down  # remove it
bun run db:generate  # regenerate the prisma client (postinstall does it too)
bun run db:migrate   # create/apply a migration in dev (prisma migrate dev)
bun run db:deploy    # apply migrations in prod/CI (prisma migrate deploy)
bun run db:migrate:test  # apply migrations to the test database
bun run db:seed      # insert the sample rows (src/database/seed.ts)
bun run db:studio    # browse the database
bun run api:spec     # rebuild openapi.json from the controllers
```

## Architecture notes

### Global route prefix (`src/api-prefix.ts`)

Every controller route is served under **`/api`**, Swagger included. It is what
lets the api and the frontend share one origin: a reverse proxy forwards
`/api/*` here unchanged and everything else to Next, and a page route such as
the frontend's `/users` cannot shadow the endpoint of the same name.

The prefix is applied twice, and the two must agree: `configureApp()` sets it
for the server and the e2e suite, and `scripts/generate-openapi.ts` sets it for
the committed spec. `SwaggerModule` registers on the adapter directly and
ignores the global prefix, so `swagger.setup.ts` spells the path out. Changing
the prefix means regenerating the spec and the client (`bun run api:sync`);
the e2e drift check fails if only one side moved.

### Fastify instead of Express

`main.ts` bootstraps the app with `FastifyAdapter`. Fastify listens on `0.0.0.0`
(Express-based middleware won't work — use `@fastify/*` equivalents).

### Environment variables & config (`src/config/`)

- Managed by `@nestjs/config` + validated with a **zod** schema in `src/config/env.ts`.
- `.env` is loaded normally; with `NODE_ENV=test` the app and `prisma.config.ts`
  load `.env.test` with override semantics (`src/config/env-file.ts`), so ambient
  `DATABASE_URL` / `REDIS_URL` values cannot redirect cleanup. Vitest only
  defaults `NODE_ENV` to `test` when it is unset, so the test scripts set it
  explicitly - otherwise an exported `NODE_ENV=development` would point the
  suite at your dev database.
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

- `DATABASE_URL` and `REDIS_URL` must carry a scheme and a host: plain
  `z.url()` accepts `localhost:5432` (protocol "localhost") and `postgres:/app`
  (no host), and both would only fail deep inside a driver.
- `CORS_ORIGINS` lists the browser origins allowed to call this api, comma
  separated; empty allows none and is logged at boot. The generated client
  sends cookies, so the origins are exact - browsers refuse a wildcard together
  with credentials - and `methods` is spelled out in `app.setup.ts` because
  `@fastify/cors` otherwise allows only `GET`, `HEAD` and `POST`.
- `CACHE_NAMESPACE` prefixes every cache key and bounds what `clear()` wipes.
  It accepts only letters, digits, `_` and `-`; Redis glob characters and the
  store's separator are rejected. No default: projects must not share it.
- `LOG_LEVEL` overrides the per-environment default (`debug` in development,
  `info` in production, `silent` in tests) without a redeploy.
- Adding a variable: declare it in the zod schema (`src/config/env.ts`),
  add it to `.env.example` (`.env` is gitignored), and expose it through an
  existing or new namespace (e.g. `database.config.ts` with
  `registerAs("database", ...)` registered in `CoreModule`'s `load: [...]`).

### Database (`src/database/`)

- **Postgres 17** in Docker, **Prisma 7** with the `pg` driver adapter.
- Schema lives in `src/database/schema.prisma`, migrations in
  `src/database/migrations/`, config in `prisma.config.ts`. The generated client
  (`src/database/generated/`) is gitignored and rebuilt on `bun install`.
  Turbo's `db:generate` dependency also generates/restores it before backend
  build, type checks, tests and dev startup, using schema/config-based inputs.
- `DatabaseService` extends `PrismaClient`, verifies a real `SELECT 1` on module
  init (the pg pool connects lazily, with a 5 s connection timeout) and is
  global — inject it and use `this.db.user.findMany()`.
- Changing the schema: edit `schema.prisma`, then `bun run db:migrate` and
  `bun run db:generate`. Prisma 7 does not generate the client during migration.
- `prisma.config.ts` deliberately imports nothing from `src/`. The Dockerfile's
  `migrate` target contains the CLI, config, schema and migrations; the API
  runtime contains only generated client code and production dependencies.
  `apps/be` keeps `prisma` as a dev dependency, while `packages/migrate` is the
  narrow production manifest for that image. Keep the config's env loading in
  sync with `src/config/env-file.ts`.
- `src/database/seed.ts` is registered as the seed command. Run `bun run db:seed`
  explicitly; Prisma 7 does not seed automatically during migrations or resets.
  Upserts make repeated runs safe.
- `docker-compose.yml` reads `POSTGRES_*` and `REDIS_PORT` from `.env`; the app
  itself only reads `DATABASE_URL` and `REDIS_URL`, so keep the ports in sync.
- `docker-compose.test.yml` intentionally contains fixed disposable credentials
  and ports. Keep them aligned with the committed `.env.test` file.

### Cache (`src/cache/`)

- **Redis 7** in Docker, `@nestjs/cache-manager` on top of `cache-manager` v7
  and `@keyv/redis`. Default TTL is 5 s; every duration is in **milliseconds**,
  and a ttl of `0` is rejected because keyv would store the value forever.
- Use the global `CacheService` (`get`, `set`, `del`, `clear`, `wrap`) rather than
  `CACHE_MANAGER` directly, so the store can be swapped in one place.
  `wrap(key, fn, ttl)` is the cache-aside helper: returns the cached value, or
  runs `fn` **once for all concurrent callers** of that key, stores and returns
  its result. A `del()`, `set()` or `clear()` while `fn` runs cancels the write,
  so a stale value is not put back.
- Values are stored as-is, so `get()`, `set()`, `wrap()` and `CacheInterceptor`
  share one keyspace. The one thing that cannot be cached is `undefined` -
  Redis reads it back as a miss - so `wrap()` does not store it. Return `null`
  when "there is nothing there" is worth caching.
- **Redis down degrades, it does not fail.** The client connects with a 500 ms
  timeout and no offline queue - a command against an unreachable Redis fails
  at once instead of waiting for a reconnect that may never come. `wrap()` then
  falls back to a plain `fn()` call (a read error is a miss, a failed write is
  logged), `/api/health/ready` reports `degraded`, and the api keeps serving.
  `set`, `del` and `clear` do propagate the error, so an invalidation that
  could not reach Redis is not mistaken for a successful one.
- Nest's `CacheInterceptor` is **not** registered globally on purpose — it keys
  by URL only, which leaks responses between users on authenticated routes.
  Apply it per handler with `@UseInterceptors(CacheInterceptor)` on public
  GET endpoints. It replays the handler's value through JSON on a hit, which
  is why `envelope()` marks its result with a plain key rather than a Symbol.

### Logging

- `nestjs-pino` — structured JSON logs, `pino-pretty` in development, silent in
  tests; `LOG_LEVEL` overrides the default. Outside development, records go
  through a `multistream`: `error` and above to stderr, the rest to stdout.
- Every request is logged at a level that follows its outcome - `info` for a
  2xx/3xx, `warn` for a 4xx, `error` for a 5xx or a thrown error - with the
  `authorization`, `cookie` and `set-cookie` headers redacted, the query string
  stripped from the url (it can carry tokens), and the response headers reduced
  to `content-length` (helmet adds ~400 identical bytes otherwise).
- Requests to `/api/health/*` are not logged: healthchecks poll every few seconds
  and say nothing useful.
- Inject a scoped logger with `@InjectPinoLogger(MyService.name) logger: PinoLogger`.

### Responses

Every response is an envelope, success and failure alike:

```jsonc
{ "data": { "id": 1 } }                       // success
{ "data": [ ... ], "meta": { "nextCursor": 20, "hasNextPage": true } }
{ "data": null, "error": { "statusCode": 404, "message": "User 42 not found",
                           "timestamp": "...", "path": "/api/users/42",
                           "requestId": "..." } }
```

- **`TransformResponseInterceptor`** (`APP_INTERCEPTOR`) wraps every handler
  result as `{ data }`. To send metadata beside the payload, return
  `envelope(users, { nextCursor, hasNextPage })` — a hand-written `{ data: ... }` is deliberately
  not recognised (it would be indistinguishable from a row with a `data`
  column) and ends up nested inside a second envelope.
- A handler that returns `null` or nothing answers `{ data: null }`; document
  it with `@ApiDataResponse(Dto, { nullable: true })` so the generated type is
  nullable too.
- **`@RawResponse()`** opts a handler out of the envelope, for return values
  that are not a payload: a `StreamableFile`, an `@Sse()` observable, a dynamic
  `@Redirect()`. Such a route describes itself with `@ApiResponse` and a
  content type instead.
- **Helmet** (`@fastify/helmet`) sets security headers, registered in
  `src/app.setup.ts` so tests boot with the same middleware as the server.

### Health (`src/health/`)

- **`GET /api/health/live`** - is the process alive? Wire restart policies to this
  one; restarting a container because its database went down turns one outage
  into a crash loop.
- **`GET /api/health/ready`** - can it serve traffic? Checks Postgres with
  `SELECT 1` and Redis with a write, each under a 2 s timeout. Wire load
  balancers, container healthchecks and `docker compose up --wait` to this one.
  An unreachable database answers `503`; an unreachable Redis leaves it `200`
  with `status: "degraded"`, because serving slower beats not serving at all.
- `main.ts` calls `enableShutdownHooks()`, so `SIGTERM` (what `docker stop`
  sends) runs `onModuleDestroy` and Prisma closes its pool instead of being
  killed mid-query.

### Global providers (`core.module.ts`)

Registered via DI tokens (`APP_PIPE`, `APP_FILTER`, `APP_INTERCEPTOR`) instead of
`app.useGlobal*()` in `main.ts`, so they also apply in e2e tests and can use
injection.

- **`ValidationPipe`** (`APP_PIPE`) — validates DTOs with `class-validator`;
  `whitelist` + `forbidNonWhitelisted` reject unknown body fields, `transform`
  converts payloads to DTO instances.
- **`AllExceptionsFilter`** (`APP_FILTER`, `src/common/all-exceptions.filter.ts`) —
  turns every failure into `{ data: null, error }`, where `error` carries
  `statusCode`, `message`, `timestamp`, `path`, the response/log `requestId`
  and, on validation errors, `details`. `HttpException`s keep their
  status and message; unknown errors are logged with a stack trace and returned
  as a generic 500 (no internals leak to clients).

### OpenAPI (`src/swagger.setup.ts`)

- `nest-cli.json` enables Swagger's `classValidatorShim` for `.dto.ts` and
  `.entity.ts` files, deriving supported constraints from validation decorators.
  `@ApiProperty` remains useful for descriptions/examples and schema features
  the plugin cannot infer. `@Transform` behavior is not described by OpenAPI.
  Controller inference is disabled: response envelopes must still be explicit.
  `test/swagger-plugin.ts` applies the same DTO transformer under Vitest; it
  needs the TypeScript 6 compiler API, also declared at the workspace root so
  Bun's fallback resolution does not select the frontend's TypeScript 7.
- Swagger UI at **`/api/docs`** and the raw spec at **`/api/docs-json`**, outside
  production. `bun run api:spec` writes the same document to `openapi.json`,
  which `packages/api-client` generates the frontend's client from.
- The generator runs against `dist/`, and with `preview: true` - controllers and
  their metadata are registered without instantiating providers, so it needs
  valid env vars but neither Postgres nor Redis.
- **`@ApiDataResponse(Dto)`** documents a response the way
  `TransformResponseInterceptor` really sends it, wrapped in `{ data }`. The
  status comes from the verb (`@Post` is 201, the rest 200) or from `@HttpCode`;
  pass `{ isArray: true }` for a list, `{ nullable: true }` for a handler that
  may return nothing, or `{ meta: MetaDto }` for typed envelope metadata.
- **A route without it fails `api:spec`** - and the app's boot outside
  production, since Swagger UI builds the same document. A route that describes
  no payload would land in the spec as a status with no content, and orval would
  generate an untyped hook from it. Explicit `204`, `205` and `304` responses
  are bodyless; raw 3xx responses must document a `Location` header. This also
  applies to test-only controllers.
- Errors need no decorator - `swagger.setup.ts` attaches the error envelope as
  the `default` response of every operation.
- `operationIdFactory` names each operation `<controller><Method>`, so
  `UsersController.findAll` becomes `usersFindAll` and the generated hook
  `useUsersFindAll`. Without it a second controller with a `findAll` would
  collide in the generated client.
- After changing a controller or a DTO, run `bun run api:sync` from the repo
  root: it regenerates the spec and the client in one step.

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
- Before the app boots and again before every cleanup, the helper requires
  `NODE_ENV=test`, exact Postgres and Redis URLs from `.env.test`, local
  hostnames, and a Postgres database ending in `_test` (`test/safety.ts`).
- `bun run test:e2e` starts `docker-compose.test.yml`, applies migrations and
  removes the stack afterwards, so it needs Docker but no manual setup.
- `bun run test:e2e:watch` skips all of that, so do it once yourself:

  ```bash
  bun run docker:test:up
  bun run db:migrate:test   # required on every stack start - the test
                            # database is tmpfs and comes up empty
  bun run test:e2e:watch
  ```

### CI / CD

- `ci.yml` runs the checks, unit tests and e2e tests (the same Docker test stack
  as locally) as separate jobs on pull requests, and as the gate of every
  release. It also regenerates `openapi.json` and fails if the committed file
  is behind the controllers.
- A separate production smoke job builds all three images, migrates an isolated
  production Compose stack and runs API CRUD, SSR and dependency-outage probes.
- `release.yml` builds `apps/be/Dockerfile` from the repository root (the app
  depends on workspace packages), pushes separate runtime and migration targets
  to ghcr.io and pokes a deploy hook. The API runs `node dist/main.js` as a
  non-root user; the one-shot migration image runs `prisma migrate deploy`
  before it starts.
  See "Deployment" in the root README, and `bun run verify:images` to build and
  probe the image locally.
