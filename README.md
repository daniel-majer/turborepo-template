# Turborepo

Turborepo monorepo template with a Next.js frontend and a NestJS backend, sharing
UI components, TypeScript configs and tooling.

## Stack

|                 |                                                      |
| --------------- | ---------------------------------------------------- |
| Package manager | bun 1.3.14                                           |
| Build system    | Turborepo 2.10                                       |
| Frontend        | Next.js 16 (App Router, Turbopack, React 19)         |
| Styling         | Tailwind CSS v4 + shadcn/ui (Base UI, `nova` preset) |
| Language        | TypeScript 7 (native Go port)                        |
| Lint / format   | oxlint + oxfmt                                       |

## Structure

```
apps/
  fe/               Next.js app
  be/               NestJS app (Fastify)
packages/
  ui/               @repo/ui        — shared React components (shadcn/ui)
  ts-config/        @repo/ts-config — shared tsconfig presets
```

## Getting started

```bash
bun install
bun run dev          # fe → http://localhost:3000, be → http://localhost:3001
```

Node 22+ (`.nvmrc`, enforced by `engines`) and bun 1.3.14 (`packageManager`).

## Make it yours

After cloning, adjust the template to your project:

- **`apps/fe/.env`** — create it from the example (`cp apps/fe/.env.example apps/fe/.env`).
  Without it the build fails immediately: `src/env.ts` validates `NEXT_PUBLIC_APP_URL`
  at startup. For production, set the real URL — and update the hardcoded value in
  `.github/workflows/ci.yml` too.
- **`apps/fe/src/app/layout.tsx`** — replace the template `title` and `description`
  metadata, and change `lang="en"` if the app is in another language.
- **Root `package.json`** — rename `"turborepo-template"` to your project.
- **`README.md`** — rewrite this file for your project.
- **`LICENSE`** — the template is MIT-0, so you can delete or replace it freely;
  pick whatever license fits your project.
- **`apps/be`** — a NestJS app on Fastify (ESM + vitest, port 3001) with zod-validated
  env, a global `ValidationPipe` and a catch-all exception filter — see
  `apps/be/README.md`. Build on it, or delete the directory if you only need the
  frontend.
- **`apps/fe/public/` and fonts** — swap the favicon/assets and the Geist fonts in
  `layout.tsx` for your own branding.
- **CI** (optional) — `ci.yml` triggers on `main`; adjust for your branching model.
  For Vercel Remote Cache add `TURBO_TOKEN`/`TURBO_TEAM` secrets, otherwise the
  built-in `.turbo` cache via `actions/cache` just works.

Everything else — `turbo.json`, git hooks, `commitlint`, the tsconfig presets and
`components.json` — is project-agnostic and needs no changes.

## Commands

| Command               | What it does                            |
| --------------------- | --------------------------------------- |
| `bun run dev`         | Start all dev servers                   |
| `bun run build`       | Build all apps                          |
| `bun run check-types` | Type-check every package                |
| `bun run lint`        | Lint the whole repo                     |
| `bun run lint:fix`    | Lint and auto-fix                       |
| `bun run format`      | Check formatting (fails if unformatted) |
| `bun run format:fix`  | Format the repo                         |
| `bun run boundaries`  | Check package isolation                 |

`turbo run quality` runs lint and format together (`quality:fix` to fix). It is a
pure aggregator with no matching script, so it works only via `turbo run`.

## Packages

`apps/*` and `packages/*` are bun workspaces, referenced by name
(`"@repo/ui": "workspace:*"`), never by relative path.

`packages/ui` ships `.tsx` source directly — no build step, no `dist/`. The app's
bundler compiles it, and its `exports` map decides what apps may import. The
theme lives in `packages/ui/src/styles/globals.css`; the app imports it and only
adds its own fonts.

`@repo/ts-config` holds the tsconfig presets. Each package extends one and keeps
only what is local (paths, includes, source/output directories):

| Preset               | Used by                                                       |
| -------------------- | ------------------------------------------------------------- |
| `base.json`          | shared foundation, not used directly                          |
| `nextjs.json`        | `apps/fe`                                                     |
| `react-library.json` | `packages/ui`                                                 |
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

Validated with [t3-env](https://env.t3.gg) + zod. Each app owns its schema
(`apps/fe/src/env.ts`) and its own `.env` — there is no root `.env`, so it stays
clear which app needs what.

`next.config.ts` imports the schema, so a missing or malformed variable **fails
the build** instead of surfacing as `undefined` at runtime. Import `env` rather
than reading `process.env` directly: server variables are then a type error in
client components, which keeps secrets out of the browser bundle.

Copy `apps/fe/.env.example` to `apps/fe/.env` to get started. `NODE_ENV` is not
listed there — Next.js sets it from the command it runs.

Server variables must also be declared in `turbo.json` under `env`, or strict
mode filters them out and the build fails validation. `NEXT_PUBLIC_*` is inferred
automatically.

## Git hooks

Managed by husky; `prepare: husky` wires them up on every `bun install`, so a
fresh clone needs no extra step.

| Hook         | Runs                            | Scope                                        |
| ------------ | ------------------------------- | -------------------------------------------- |
| `pre-commit` | `lint-staged`                   | staged files only — fixes and re-stages them |
| `commit-msg` | `commitlint`                    | message format                               |
| `pre-push`   | `turbo run quality check-types` | whole repo, check only                       |

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

`.github/workflows/ci.yml` and `.gitlab-ci.yml` do the same thing — the commands
are identical, only the wrapper differs. Use whichever platform applies; the
other file is inert.

```bash
turbo run quality check-types build --affected
turbo boundaries
```

`--affected` limits the run to packages touched since the base branch, so it needs
full git history (`fetch-depth: 0` / `GIT_DEPTH: 0`). The `.turbo` directory is
cached between runs.

`turbo boundaries` fails the build if a package reaches into another package's
internals instead of going through its `exports`.

`HUSKY: 0` is set in both files — git hooks are pointless in CI, which runs the
same checks directly.

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
`tsc --noEmit` write `tsconfig.tsbuildinfo`.

## License

[MIT-0](LICENSE) — use the template however you like, no attribution required.
