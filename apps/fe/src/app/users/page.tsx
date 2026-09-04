import { prefetchUsersFindAllQuery } from "@repo/api-client";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { Suspense } from "react";

import { UsersPanel } from "./users-panel";

/**
 * The server half of the prefetch/hydrate pattern: this component fetches the
 * list while it renders, ships the result in the html, and the client hook
 * below reads a warm cache instead of suspending on a request of its own.
 *
 * A QueryClient created here is per-request and thrown away; the one the
 * browser keeps lives in Providers.
 */
/**
 * Rendered per request, never at build time.
 *
 * Without this Next prerenders the page during `next build`, the prefetch below
 * calls an api that is not running (in CI it never is), and the build fails on
 * ECONNREFUSED. User data is per-request anyway - a snapshot taken at build
 * time would be stale the moment anyone signs up.
 */
export const dynamic = "force-dynamic";

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
        {/*
          prefetchQuery never rejects, so an api that is down still gets here
          with an empty cache and the suspense hook below asks again. Without
          this boundary that second failure escapes to the root error.tsx and
          replaces the whole page; with it, only the panel is affected - and
          users/error.tsx catches the throw.
        */}
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
