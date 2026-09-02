# be

NestJS backend running on **Fastify** (via `@nestjs/platform-fastify`).

## Setup

```bash
bun install
cp .env.example .env
```

## Scripts

```bash
bun run dev          # start in watch mode
bun run build        # compile to dist/
bun run start        # run compiled app
bun run check-types  # tsc --noEmit
bun run test         # unit tests (vitest)
bun run test:e2e     # e2e tests
bun run test:cov     # unit tests with coverage
```

## Architecture notes

### Fastify instead of Express

`main.ts` bootstraps the app with `FastifyAdapter`. Fastify listens on `0.0.0.0`
(Express-based middleware won't work — use `@fastify/*` equivalents).

### Environment variables & config (`src/config/`)

- Managed by `@nestjs/config` + validated with a **zod** schema in `src/config/env.ts`.
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

### Global providers (`app.module.ts`)

Registered via DI tokens (`APP_PIPE`, `APP_FILTER`) instead of `app.useGlobal*()`
in `main.ts`, so they also apply in e2e tests and can use injection.

- **`ValidationPipe`** (`APP_PIPE`) — validates DTOs with `class-validator`;
  `whitelist` + `forbidNonWhitelisted` reject unknown body fields, `transform`
  converts payloads to DTO instances.
- **`AllExceptionsFilter`** (`APP_FILTER`, `src/common/all-exceptions.filter.ts`) —
  unified error responses with `statusCode`, `message`, `timestamp`, `path`.
  `HttpException`s keep their status and message; unknown errors are logged
  with stack trace and returned as a generic 500 (no internals leak to clients).

### Testing

- **Unit** (`src/*.spec.ts`) — dependencies are auto-mocked with
  `createMock` from `@golevelup/ts-vitest` (`.useMocker(() => createMock())`).
- **E2E** (`test/*.e2e-spec.ts`) — app is created with `FastifyAdapter` and
  requests are made via Fastify's `app.inject()` (no real port, no supertest).
