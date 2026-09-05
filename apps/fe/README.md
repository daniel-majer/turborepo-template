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

CI supplies placeholder public URLs and skips validation of unavailable
server-only values; the server validates again in `src/instrumentation.ts`.
`NEXT_PUBLIC_*` values are compiled into the bundle, so production passes them
as `release.yml` build args, not container runtime variables.

`NEXT_PUBLIC_API_URL` is always required. For the included routing, set it to
the API origin: generated requests already carry `/api`. A shared-origin proxy
can forward `/api/*` to the backend unchanged while `/users` stays a frontend
page. `API_URL=http://api:3001` lets server-side calls use Compose networking.

Vitest covers env validation, the API transport and the users panel's form,
mutations and cursor navigation. These component tests run without a browser.

## Production image checks

From the repository root:

```sh
bun run verify:images
```

This builds the API, migration and frontend images and starts an isolated
Compose stack. The checks exercise API CRUD, cursor pagination and confirm that
`/users` contains server-rendered database rows. The runner prints container
logs on failure and removes its disposable stack afterwards.

These HTTP checks do not execute client-side JavaScript or test hydration and
browser interactions. The template does not prescribe a browser-testing tool;
add one to suit your project's needs.
