import { prefetchUsersFindAllQuery } from "@repo/api-client";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { Suspense } from "react";

import { UsersPanel } from "./users-panel";

/** Fetch user data per request, never during builds without a running API. */
export const dynamic = "force-dynamic";

/** Prefetch into a per-request cache; HydrationBoundary passes it to the client. */
export default async function UsersPage() {
  const queryClient = new QueryClient();

  await prefetchUsersFindAllQuery(queryClient);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-24">
      <h1 className="text-3xl font-medium tracking-tight">Users</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Rendered from the backend through a client generated from its OpenAPI
        spec — the types below are not written by hand anywhere.
      </p>

      <HydrationBoundary state={dehydrate(queryClient)}>
        {/* Failed prefetches leave an empty cache; show a fallback while the client retries. */}
        <Suspense
          fallback={
            <p className="text-muted-foreground mt-8 text-sm">Loading users…</p>
          }
        >
          <UsersPanel />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
