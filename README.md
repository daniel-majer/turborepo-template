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
.oxlintrc.json      lint rules (whole repo)
.oxfmtrc.json       format rules (whole repo)
turbo.json          task pipeline
```

## Getting started

```bash
bun install
bun run dev          # http://localhost:3000
```

## Commands

Run from the repo root.

| Command               | What it does                            |
| --------------------- | --------------------------------------- |
| `bun run dev`         | Start all dev servers                   |
| `bun run build`       | Build all apps                          |
| `bun run check-types` | Type-check every package                |
| `bun run lint`        | Lint the whole repo                     |
| `bun run lint:fix`    | Lint and auto-fix                       |
| `bun run format`      | Check formatting (fails if unformatted) |
| `bun run format:fix`  | Format the repo                         |

`bun run <task>` and `turbo run <task>` are equivalent for `build`, `dev` and
`check-types`. For `lint` and `format` the `bun` form runs the tool directly;
`turbo run` adds caching, which makes no practical difference since oxlint
finishes in ~20 ms.

## How it works

### Workspaces

`apps/*` and `packages/*` are bun workspaces. Internal packages are referenced by
name with `"@repo/ui": "workspace:*"` — never by relative path.

`packages/ui` is a **JIT package**: it exports `.tsx` source directly and is
compiled by the consuming app's bundler. It has no build step and produces no
`dist/`.

### TypeScript

`@repo/ts-config` holds four presets. Each package extends one and keeps only
what is genuinely local (paths, includes):

| Preset               | Used by                                            |
| -------------------- | -------------------------------------------------- |
| `base.json`          | shared foundation, not used directly               |
| `nextjs.json`        | `apps/fe`                                          |
| `react-library.json` | `packages/ui`                                      |
| `nestjs.json`        | `apps/be` — CommonJS, decorators, emits to `dist/` |

Versions are pinned exactly (`7.0.2`, not `^7`). TypeScript minor releases
routinely add stricter checks that break builds.

### UI components

`packages/ui` uses Node subpath imports (`#components/*`) internally and a
`package.json` `exports` map externally. Anything an app imports must be listed
in `exports`.

The theme lives in `packages/ui/src/styles/globals.css` as a single source of
truth. `apps/fe/src/app/globals.css` imports it and only supplies its own fonts.

### Adding a shadcn component

Always run `add` **from the app**, never from `packages/ui`:

```bash
cd apps/fe
bunx shadcn@latest add dialog      # primitives  → packages/ui automatically
bunx shadcn@latest add login-form  # blocks      → apps/fe/src/components
```

The CLI routes each component using the aliases in `apps/fe/components.json`.
`shadcn init -c packages/ui` does **not** work — `init` requires a real
framework, and a UI package is not one.

Formatting drifts from upstream after `add`, so run `bun run format:fix`
afterwards.

### Lint and format

oxlint and oxfmt run as Turborepo **root tasks** (`//#lint`, `//#format`) over
the whole repo at once, rather than per package. This follows the
[official Oxc guide](https://turborepo.dev/docs/guides/tools/oxc): both tools are
fast enough that orchestrating per-package tasks costs more than it saves.

Individual packages therefore have no `lint` script. To lint one area, pass a
path: `bunx oxlint apps/fe`.

`oxfmt` replaces Prettier and covers three things Prettier needs plugins for:
`sortImports`, `sortTailwindcss` and `sortPackageJson`.

### Caching

Turborepo hashes each task's inputs and replays stored results on a match,
including restoring output files. A cold `build` takes ~8 s; a cached one ~30 ms.
Cache lives in `.turbo/` and is safe to delete.

Tasks that write files declare them in `outputs` — otherwise the files are lost
on a cache hit. This includes `check-types`, because `incremental: true` makes
`tsc --noEmit` write `tsconfig.tsbuildinfo`.
