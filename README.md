# Turborepo

> **TODO(template):** Complete the “Make it yours” checklist after cloning.

Turborepo monorepo template with a Next.js frontend and a NestJS backend, sharing
UI components, TypeScript configs and tooling.

## Stack

|                 |                                                                    |
| --------------- | ------------------------------------------------------------------ |
| Package manager | bun 1.3.14                                                         |
| Build system    | Turborepo 2.10                                                     |
| Frontend        | Next.js 16 (App Router, Turbopack, React 19)                       |
| Styling         | Tailwind CSS v4 + shadcn/ui (Base UI, `nova` preset)               |
| Language        | TypeScript 7 for frontend/packages; TS 6 for Nest compiler plugins |
| Lint / format   | oxlint + oxfmt                                                     |
| Deployment      | Docker images, published to ghcr.io by `release.yml`               |

## Structure

```
apps/
  fe/               Next.js app
  be/               NestJS app (Fastify)
packages/
  ui/               @repo/ui         — shared React components (shadcn/ui)
  api-client/       @repo/api-client — typed API client generated from the backend
  migrate/          @repo/migrate    — minimal dependencies for the migration image
  ts-config/        @repo/ts-config  — shared tsconfig presets
```

## Getting started

```bash
bun install                      # also generates the Prisma client and the API client
bun run setup                    # copies every .env.example that does not exist yet
bun run dev                      # starts Postgres + Redis, applies migrations, then both apps
                                 # fe → http://localhost:3000, be → http://localhost:3001
bun run --cwd apps/be db:seed    # optional: two sample users
```

`http://localhost:3000/users` is a working end-to-end example: a page that
lists, creates and deletes users through a client generated from the backend's
OpenAPI spec. `http://localhost:3001/api/docs` is the Swagger UI for the same
spec, and `http://localhost:3001/api/health/ready` says whether Postgres and
Redis are reachable.

Use Node 22 (`.nvmrc`, CI and both Docker build/runtime stages) and bun 1.3.14
(`packageManager`). The minimum supported Node version is 22.12.0.
Root overrides keep Prisma's transitive tools on patched releases; recheck them
when upgrading Prisma rather than removing them blindly.

## Make it yours

After cloning, resolve every `TODO(template)` marker and adjust the remaining
files that cannot contain comments:

- **`apps/fe/.env`** — create it from the example (`cp apps/fe/.env.example apps/fe/.env`).
  Without it the build fails immediately: `src/env.ts` validates both public
  URLs. For production, set their real values and update `.github/workflows/ci.yml`.
- **`apps/fe/src/app/layout.tsx`** — replace the template `title` and `description`
  metadata, and change `lang="en"` if the app is in another language.
- **Root `package.json`** — rename `"turborepo-template"` to your project (JSON
  does not support an inline TODO comment).
- **README files** — rewrite the root and app-specific documentation for your
  project.
- **`LICENSE`** — the template is MIT-0, so you can delete or replace it freely;
  pick whatever license fits your project.
- **`apps/be`** — a NestJS app on Fastify (ESM + vitest, port 3001) with zod-validated
  env, Prisma + Postgres, a Redis cache, pino logging, a global `ValidationPipe`
  and a catch-all exception filter. Postgres and Redis run via Docker; the quick
  start above creates the backend env, starts both services, and applies the
  Prisma migrations before `bun run dev` — see `apps/be/README.md`.
- **Frontend only?** The backend is not optional by accident — `apps/fe` imports
  `@repo/api-client`, which is generated from `apps/be/openapi.json`. To drop it,
  delete `apps/be` **and** `packages/api-client`, remove `@repo/api-client` from
  `apps/fe/package.json`, delete `apps/fe/src/app/users/`, drop
  `NEXT_PUBLIC_API_URL` / `API_URL` from `apps/fe/src/env.ts` and `.env.example`,
  and remove the `api:sync` script here. Then `bun install`.
- **`apps/fe/public/` and fonts** — swap the favicon/assets and the Geist fonts in
  `layout.tsx` for your own branding.
- **CI** — `ci.yml` runs four parallel jobs (checks, unit tests, API e2e tests,
  production-image smoke) on pull requests, and again as the first job of every
  release; adjust for your
  branching model. Shared setup lives in `.github/actions/setup`. For Vercel
  Remote Cache, add `TURBO_TOKEN` as a GitHub Actions repository secret and
  `TURBO_TEAM` as a repository variable. The workflow exposes both to Turbo;
  without them, the built-in `.turbo` cache via `actions/cache` still works.
- **Deployment** — `apps/*/Dockerfile`, `docker-compose.prod.yml`,
  `.env.production.example` and `.github/workflows/release.yml` ship the apps as
  API, frontend and migration images, see [Deployment](#deployment). After
  cloning, update the `COPY`
  lines at the top of both Dockerfiles list every workspace package (add yours),
  the `name:` in `docker-compose.prod.yml` must be unique per host, and the
  `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_API_URL` repository variables feed the
  frontend image's build args.

Everything else — `turbo.json`, git hooks, `commitlint`, the tsconfig presets and
`components.json` — is project-agnostic and needs no changes.

## Commands

| Command                         | What it does                                               |
| ------------------------------- | ---------------------------------------------------------- |
| `bun run dev`                   | Start all dev servers                                      |
| `bun run build`                 | Build all apps                                             |
| `bun run check-types`           | Type-check every package                                   |
| `bun run lint`                  | Lint the whole repo                                        |
| `bun run lint:fix`              | Lint and auto-fix                                          |
| `bun run format`                | Check formatting (fails if unformatted)                    |
| `bun run format:fix`            | Format the repo                                            |
| `bun run boundaries`            | Check package isolation                                    |
| `bun run audit`                 | Audit the locked dependency graph                          |
| `bun run test`                  | Package and release-workflow tests                         |
| `bun run test:e2e`              | e2e + integration tests (needs Docker)                     |
| `bun run api:sync`              | Regenerate the API spec and its client                     |
| `bun run setup`                 | Create the missing `.env` files                            |
| `bun run --cwd apps/be db:seed` | Insert the sample rows                                     |
| `bun run verify:images`         | Production images, API and SSR smoke checks (needs Docker) |
| `bun x turbo run quality`       | Run lint and format checks together                        |
| `bun x turbo run quality:fix`   | Fix lint and formatting issues                             |

Package tests delegate to Turbo; the release promotion test runs at the root.
Quality uses `bun x` for its Turbo root-task aggregator. No global Turbo install
is required.

## Packages

`apps/*` and `packages/*` are bun workspaces, referenced by name
(`"@repo/ui": "workspace:*"`), never by relative path.

`packages/ui` ships `.tsx` source directly — no build step, no `dist/`. The app's
bundler compiles it, and its `exports` map decides what apps may import. The
theme lives in `packages/ui/src/styles/globals.css`; the app imports it and only
adds its own fonts. Its tests cover the shared component's public behavior.

`packages/migrate` has no source code. Its small dependency manifest keeps
Prisma CLI tooling in the migration image without pulling backend dev tools or
the CLI into the API runtime.

`@repo/ts-config` holds the tsconfig presets. Each package extends one and keeps
only what is local (paths, includes, source/output directories):

| Preset               | Used by                                                       |
| -------------------- | ------------------------------------------------------------- |
| `base.json`          | shared foundation, not used directly                          |
| `nextjs.json`        | `apps/fe`                                                     |
| `react-library.json` | `packages/ui`, `packages/api-client`                          |
| `nestjs.json`        | `apps/be` — NodeNext, decorators; app owns `src`/`dist` paths |

## Adding a shadcn component

Always run `add` **from the app**, never from `packages/ui`:

```bash
cd apps/fe
bunx shadcn@latest add dialog      # primitives → packages/ui automatically
bunx shadcn@latest add login-form  # blocks     → apps/fe/src/components
```

The CLI routes each component using the aliases in `apps/fe/components.json`.
`shadcn init -c packages/ui` does **not** work — `init` requires a real
framework, and a UI package is not one. Run `bun run format:fix` afterwards.

## Lint and format

oxlint and oxfmt run as Turborepo root tasks over the whole repo at once, per the
[official Oxc guide](https://turborepo.dev/docs/guides/tools/oxc) — both are fast
enough that per-package tasks would cost more than they save. Packages have no
`lint` script; to lint one area, pass a path: `bunx oxlint apps/fe`.

Linting is **type-aware** (`options.typeAware` in `.oxlintrc.json`, powered by
`oxlint-tsgolint`), so rules like `no-floating-promises` work. It costs ~130 ms
over a plain run.

oxfmt replaces Prettier, with `sortImports`, `sortTailwindcss` and
`sortPackageJson` built in.

## Typed routes

`next.config.ts` sets `typedRoutes: true`, so a literal `href` that does not match
a real route is a type error rather than a runtime 404.

The types come from `next typegen`, which is why `apps/fe`'s `check-types` script
is `next typegen && tsc --noEmit`. Plain `tsc --noEmit` cannot see `LayoutProps`,
`PageProps` or the route list — they are generated into `.next/types`, not shipped
with the `next` package.

## Environment variables

Each app owns its schema and its own `.env` — there is no root `.env`, so it
stays clear which app needs what. The frontend uses
[t3-env](https://env.t3.gg) + zod (`apps/fe/src/env.ts`); the backend uses a
plain zod schema read through `@nestjs/config` (`apps/be/src/config/env.ts`, see
`apps/be/README.md`). The rest of this section is about the frontend.

`next.config.ts` imports the schema, so a missing or malformed variable **fails
the build** instead of surfacing as `undefined` at runtime. Import `env` rather
than reading `process.env` directly: server variables are then a type error in
client components, which keeps secrets out of the browser bundle.

Copy `apps/fe/.env.example` to `apps/fe/.env` to get started. `NODE_ENV` is not
listed there — Next.js sets it from the command it runs.

Server variables must also be declared in `turbo.json` under `env`, or strict
mode filters them out and the build fails validation. `NEXT_PUBLIC_*` is inferred
automatically.

## API contract

The frontend never hand-writes a request or a response type. The backend's
OpenAPI spec is the contract, and everything below it is generated:

```
apps/be DTOs + @ApiDataResponse       hand-written
   └─ bun run --cwd apps/be api:spec  → apps/be/openapi.json   (committed)
        └─ packages/api-client        → TanStack Query hooks, TS types,
                                        zod schemas for request bodies
             └─ apps/fe               imports @repo/api-client
```

`bun run api:sync` runs both steps. The spec is **committed** on purpose: a
change to the API shows up as a reviewable diff next to the code that caused
it, and a fresh clone can generate a client with no backend running.
`packages/api-client/src/generated/` is not committed — it is rebuilt by the
package's `postinstall`, the same way the Prisma client is.

The Nest Swagger compiler plugin derives supported constraints from
`class-validator` decorators: `@IsEmail()` and `@MaxLength()` do not need to be
repeated in `@ApiProperty()`. Description/example overrides stay explicit.
The Vitest DTO transformer reads the same plugin settings from `nest-cli.json`,
and an integration test compares the complete served spec with the committed one.
The backend and root tooling deliberately retain TypeScript 6: the Swagger
plugin needs its JavaScript compiler API. The root declaration ensures Bun's
fallback resolution does not pick the frontend's native TypeScript 7 package.

Rename a field in a backend DTO, run `api:sync`, and `check-types` fails in
whichever component still uses the old name. That is the whole point, and two
pieces of wiring are what make it hold:

- `apps/be/openapi.json` is a **global dependency** in `turbo.json`. The
  generated client is gitignored, and Turborepo hashes only tracked files, so a
  task that consumes it would otherwise replay a stale cache after the contract
  changed.
- `packages/api-client` declares **`be` as a devDependency**. It imports nothing
  from it — the edge exists so `turbo --affected` knows a pull request touching
  only the backend has to type-check and build the frontend too. Without it CI
  skips `fe` entirely and a breaking contract change merges green.

Every backend route lives under **`/api`** (`apps/be/src/api-prefix.ts`),
including Swagger. That is what lets both apps share one origin: a reverse
proxy forwards `/api/*` to the backend as-is - no path rewriting - and
everything else to the frontend, and a page route such as `/users` can never
shadow the endpoint of the same name.

Two environment variables connect the two sides, and they must agree:
`CORS_ORIGINS` in `apps/be/.env` lists the origins CORS lets in (comma
separated, empty allows none), and `NEXT_PUBLIC_API_URL` in `apps/fe/.env` is
the explicit absolute base where the browser sends requests. For this routing,
use the bare origin: generated requests already carry `/api`. An optional path
is only for mounting the whole backend below another proxy segment. Server-side
calls use `API_URL` when Next reaches the API through an internal address such
as `http://api:3001`.

The prefix is applied in `configureApp()` and again in
`scripts/generate-openapi.ts`, because the spec has to describe the paths the
server really serves. The e2e drift check compares the two documents, so
forgetting one of them fails CI rather than shipping a client that calls the
wrong URLs.

## Deployment

The template does not pick a host. It publishes a container image per app to
the GitHub Container Registry and stops there, which is the last point that is
the same everywhere - a VPS, Fly, Render, Coolify or Kubernetes all start from
a pushed image.

`.github/workflows/release.yml` runs on a push to `main` or a `v*` tag: CI
first, then candidate images for `be`, `fe` and `migrate`. Only after all three
builds succeed are their digests promoted to a matching `run-<id>-<attempt>`
set and the shared aliases. Releases are serialized across branches and tags;
`latest` is explicit and only moves on the default branch. Other aliases are
`sha-<commit>`, plus `1.2.3` and `1.2` for semver tags.

The last job sends `{ imageTag, revision }` to `DEPLOY_HOOK_URL` if it exists.
The host must deploy that `imageTag`; it identifies the complete three-image
set. Replace this step with SSH or a host CLI when needed.

**Running the images.** `docker-compose.prod.yml` pulls all three, plus Postgres
and Redis, and is meant to be copied to a host along with a filled-in `.env`
(see `.env.production.example`):

```sh
# once: a package pushed to ghcr.io is private until you say otherwise, so
# either make all three packages public in their GitHub package settings, or give
# the host a read:packages token
echo <token> | docker login ghcr.io --username <owner> --password-stdin

docker compose --file docker-compose.prod.yml pull
docker compose --file docker-compose.prod.yml up --detach --wait
```

A one-shot `migrate` service applies pending migrations before the api
starts, and the api waits on `service_completed_successfully`, so a failed
migration stops the deploy instead of leaving an api running against a schema
it does not expect. Prisma CLI and its driver tooling exist only in this
migration image, not in the API runtime. The databases publish no host ports;
the apps bind to loopback behind the host's TLS reverse proxy. For deploys and
rollbacks, set `IMAGE_TAG` to a successful release's exact
`run-<id>-<attempt>` value, then run `pull` and `up`.

Generate `POSTGRES_PASSWORD` with `openssl rand -hex 32`, not with the more
common `base64` form: compose substitutes it into a `postgresql://` URL
verbatim, and a `/` or `+` in a password changes what that URL means.

The api connects as a role of its own (`APP_DB_USER`), created by an init
script the first time Postgres starts on an empty volume, with read/write on
the tables and nothing else; only the one-shot `migrate` job uses the owner.
Redis requires `REDIS_PASSWORD`. The app containers run read-only with every
capability dropped - the comments in the compose file say what each service
keeps and why.

`bun run verify:images` builds all three images and starts `docker-compose.prod.yml`
with disposable credentials, unique project/image names and random loopback
ports. It checks migrations, the restricted runtime DB role through CRUD,
the API runtime dependency set, non-root processes, health endpoints, cursor
pagination, request IDs, validation, CORS, SSR, a Compose boot without Redis,
and readiness during a database outage.
The verification command needs no browser installation. It prints container
logs on failure and removes only its own Docker resources on exit; it never
reuses the dev or API-test database.

**Before the first deploy.** `PLATFORMS` in `release.yml` is `linux/amd64`;
an ARM host (Oracle's free Ampere instances, AWS Graviton) needs `linux/arm64`
added there and the QEMU step uncommented. And `NEXT_PUBLIC_*` variables are
compiled into the frontend bundle, so they belong in the build args of the
workflow (the `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_API_URL` repository
variables), not in the environment of the running container, where they would
be ignored. `NEXT_PUBLIC_API_URL` is required even when other build-time env
validation is skipped, so a release cannot silently fall back to a relative
base.

## Git hooks

Managed by husky; `prepare: husky` wires them up on every `bun install`, so a
fresh clone needs no extra step.

| Hook         | Runs                                  | Scope                                        |
| ------------ | ------------------------------------- | -------------------------------------------- |
| `pre-commit` | `lint-staged`                         | staged files only — fixes and re-stages them |
| `commit-msg` | `commitlint`                          | message format                               |
| `pre-push`   | `bun x turbo run quality check-types` | whole repo, check only                       |

`pre-commit` auto-fixes what it can and stages the result, so the fix lands in the
same commit. If a lint error is not auto-fixable, it aborts and restores the
original files. Warnings never block — only errors do.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
with a **required** scope:

```
<type>(<scope>): <subject>        scope ∈ fe | be | tooling | deps | deps-dev

feat(fe): add user profile page
chore(tooling): enable type-aware linting
```

## CI

`.github/workflows/ci.yml` runs on every pull request and, through
`workflow_call`, as the first job of `release.yml` - so a push to `main` runs it
once, as the release's gate, not twice. It covers quality, type checking,
builds, boundaries, the API spec, unit tests, Docker-backed e2e/integration
tests, and production-image smoke tests.

```bash
bun x turbo run quality check-types --affected
bun run audit
bun x turbo run build --affected        # with SKIP_ENV_VALIDATION=true
bun x turbo boundaries
bun run --cwd apps/be api:spec          # then: is openapi.json unchanged?
bun x turbo run test --affected
node --test scripts/promote-images.test.mjs
bun x turbo run test:e2e --affected
bun run verify:images                 # always runs, including infrastructure-only changes
```

Type checking finishes before the build starts because both commands generate
files under `dist` or `.next`. The build sets `SKIP_ENV_VALIDATION=true` for
server-only values, while CI still supplies the required public URLs. The spec
step regenerates `apps/be/openapi.json`
and fails if it differs from the committed file - a controller changed without
`bun run api:sync` would otherwise leave the generated client a version behind.
Unit and e2e tests run as separate jobs. On the default branch the workflow
omits `--affected` and runs the full suite.

`--affected` limits the run to packages touched since the base branch, so it needs
full git history (`fetch-depth: 0`). The `.turbo` directory is cached between runs.

`bun x turbo boundaries` fails the build if a package reaches into another package's
internals instead of going through its `exports`.

`HUSKY: 0` is set in the workflow — git hooks are pointless in CI, which runs
the same checks directly.

Every action is pinned to a commit rather than a movable tag. `renovate.json`
configures dependency and action-pin updates, without automatic merging.
Enable the Renovate GitHub App for the repository (or run it yourself); adding
the configuration file alone does not start an updater.

### Hooks failing in a git GUI

Hooks run `bun`, and GUI git clients do not load your shell profile, so `bun` may
not be on their `PATH` (`bun: not found`). Fix it once per machine in
`~/.config/husky/init.sh`:

```sh
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

Add your Node version manager's init there too if you use one.

## Caching

Turborepo replays stored results for unchanged inputs, restoring output files
too — a cold `build` takes ~8 s, a cached one ~30 ms. Cache lives in `.turbo/`
and is safe to delete.

Tasks that write files must declare them in `outputs`, or the files are lost on a
cache hit. This includes `check-types`, since `incremental: true` makes
`tsc --noEmit` write `tsconfig.tsbuildinfo`; the frontend task also caches the
`.next/types` and `next-env.d.ts` files generated by `next typegen`. Frontend
`.env*` files are explicit task inputs, so environment changes invalidate those
generated types.

`db:generate` is a backend task with schema/config inputs and
`src/database/generated/**` outputs. Backend build, type checking, tests and
development startup depend on it, so deleting the generated client does not
require reinstalling dependencies. Build and type checking use separate
TypeScript incremental-cache files to avoid restoring each other's state.

## Publishing this template

The code and license can be shared as a template. Before making the repository
public, review the full Git history for accidentally committed secrets (ignore
rules do not remove old commits), enable GitHub's **Template repository** and
**Private vulnerability reporting** settings, and install Renovate. Protect the
default branch with required CI checks. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the contribution workflow, [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for
community expectations and [SECURITY.md](SECURITY.md) for private reports.

The `/users` example is deliberately unauthenticated. A real application still
needs its own authentication/authorization, abuse controls, TLS, backups and
monitoring before handling real user data. The Docker setup and tests verify
the template's infrastructure; they do not supply those product-level decisions.

## License

[MIT-0](LICENSE) — use the template however you like, no attribution required.
