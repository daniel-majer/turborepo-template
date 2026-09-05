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
  env.ts               t3-env schema, validated at build time and at server start
  instrumentation.ts   runs the env validation when the server starts
public/                served as-is at the site root
```

UI components come from `@repo/ui`; the Tailwind theme lives there too. See the
[root README](../../README.md) for adding shadcn components, environment
variables and the git hooks.

## Talking to the backend

Never write a `fetch` against the API by hand. `@repo/api-client` is generated
from the backend's OpenAPI spec and exports a hook per endpoint:

```tsx
"use client";
import { useUsersFindAll } from "@repo/api-client";

const { data } = useUsersFindAll();
data?.data; // UserDto[] - the outer data is react-query's, the inner one the api envelope
```

`src/app/users/` is a full example: the server component prefetches into a
`QueryClient` and hands it through `HydrationBoundary`, the client component
reads the warm cache with the suspense hook, and mutations invalidate the list
by its generated query key. Request bodies are validated against the zod schemas
in `@repo/api-client/schemas`. The spec comes from the backend DTOs; runtime
backend validation itself is performed by `class-validator`.

A page that calls the API cannot be prerendered - `export const dynamic =
"force-dynamic"` - or `next build` fails on a connection refused with no
backend running. See the [root README](../../README.md#api-contract).

## Production build

`next.config.ts` sets `output: "standalone"`: `next build` writes a
self-contained server into `.next/standalone` with only the `node_modules` it
reaches, and that is what `Dockerfile` ships (`node apps/fe/server.js`, as a
non-root user, read-only apart from `.next/cache`).

A build has no real values for `src/env.ts`, so CI and the image build set
`SKIP_ENV_VALIDATION=true`; the server validates again when it starts, in
`src/instrumentation.ts`. `NEXT_PUBLIC_*` variables are compiled into the
bundle, so in production they are build args of `release.yml` (the
`NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_API_URL` repository variables), not
environment variables of the running container. Leave `NEXT_PUBLIC_API_URL`
unset when one reverse proxy serves both apps under a single origin - the
generated client then sends relative requests - and set `API_URL` on the
container for the server side, where a relative url has nothing to resolve
against.

## Production image checks

From the repository root:

```sh
bun run verify:images
```

This builds both production images and starts an isolated Compose stack. The
checks exercise API CRUD and confirm that `/users` returns server-rendered HTML
containing a real database row. The runner prints container logs on failure and
removes its disposable stack afterwards.

These HTTP checks do not execute client-side JavaScript or test hydration and
browser interactions. The template does not prescribe a browser-testing tool;
add one to suit your project's needs.
