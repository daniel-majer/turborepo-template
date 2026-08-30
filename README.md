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
  be/               NestJS app (not scaffolded yet)
packages/
  ui/               @repo/ui        — shared React components (shadcn/ui)
  ts-config/        @repo/ts-config — shared tsconfig presets
```

## Getting started

```bash
bun install
bun run dev          # http://localhost:3000
```

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

## Packages

`apps/*` and `packages/*` are bun workspaces, referenced by name
(`"@repo/ui": "workspace:*"`), never by relative path.

`packages/ui` ships `.tsx` source directly — no build step, no `dist/`. The app's
bundler compiles it, and its `exports` map decides what apps may import. The
theme lives in `packages/ui/src/styles/globals.css`; the app imports it and only
adds its own fonts.

`@repo/ts-config` holds the tsconfig presets. Each package extends one and keeps
only what is local (paths, includes):

| Preset               | Used by                                            |
| -------------------- | -------------------------------------------------- |
| `base.json`          | shared foundation, not used directly               |
| `nextjs.json`        | `apps/fe`                                          |
| `react-library.json` | `packages/ui`                                      |
| `nestjs.json`        | `apps/be` — CommonJS, decorators, emits to `dist/` |

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

## Caching

Turborepo replays stored results for unchanged inputs, restoring output files
too — a cold `build` takes ~8 s, a cached one ~30 ms. Cache lives in `.turbo/`
and is safe to delete.

Tasks that write files must declare them in `outputs`, or the files are lost on a
cache hit. This includes `check-types`, since `incremental: true` makes
`tsc --noEmit` write `tsconfig.tsbuildinfo`.
