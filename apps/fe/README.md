# fe

<!-- TODO(template): Rewrite this app README for your project. -->

Next.js frontend of the [turborepo-template](../../README.md) monorepo.

Run everything from the repo root — `turbo` orchestrates the dependency graph and
caching, so running commands here directly skips both:

```bash
bun run dev            # all apps
bun run dev --filter=fe   # this app only
```

## Layout

```
src/
  app/                 App Router: layout, page, error, not-found
  env.ts               t3-env schema, validated at build time
```

UI components come from `@repo/ui`; the Tailwind theme lives there too. See the
[root README](../../README.md) for adding shadcn components, environment
variables and the git hooks.
