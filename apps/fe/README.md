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
in `@repo/api-client/schemas`, generated from the same spec the backend
validates with.

A page that calls the API cannot be prerendered - `export const dynamic =
"force-dynamic"` - or `next build` fails on a connection refused with no
backend running. See the [root README](../../README.md#api-contract).
