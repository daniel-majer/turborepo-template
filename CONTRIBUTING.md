# Contributing

Keep the template small and reusable. Bug fixes, reproducibility improvements
and focused examples are welcome; discuss new infrastructure or product-specific
features in an issue before implementing them. Use [SECURITY.md](SECURITY.md)
for vulnerabilities, not a public issue.

## Local setup

Use Node 22 (`.nvmrc`), Bun 1.3.14 (`packageManager`) and Docker with Compose v2.
Run these commands from the repository root:

```sh
bun install --frozen-lockfile
bun run setup
bun run dev
```

Never commit real environment files or credentials. `.env.example` files and
the backend's `.env.test` contain only local, disposable values.

## Before opening a pull request

```sh
bun run api:sync          # when changing controllers, DTOs or API metadata
bun run audit
bun x turbo run quality check-types
bun run build
bun run boundaries
bun run test
bun run test:e2e          # creates and removes the backend's Docker test stack
```

For a Docker, runtime, server-rendering or deployment change, also run:

```sh
bun run verify:images
```

The last command builds all three production images and exercises their isolated
Compose stack, API CRUD, server-rendered HTML and dependency outages. It
removes only its own containers, volumes and image tags, including after a
failure, and prints container logs to help diagnose a failed run.

Commit `apps/be/openapi.json` and `bun.lock` when they change, but never the
generated Prisma/API clients. After editing the database schema, create a
migration with `bun run --cwd apps/be db:migrate` and regenerate the client
with `bun run --cwd apps/be db:generate`. Turbo also generates it before backend
builds, type checks, tests and development startup.

Describe the problem, the change and the checks you ran in the PR. Add a
regression test for a bug fix. Use scoped Conventional Commits, for example
`fix(be): reject unavailable database at startup` or
`chore(tooling): verify production images in CI`. Do not bypass failing hooks
or CI checks to merge a change.
