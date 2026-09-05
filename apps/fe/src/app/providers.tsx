"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// Retry transient 4xx errors.
const TRANSIENT_CLIENT_STATUSES = new Set([408, 425, 429]);

const MAX_BACKOFF_MS = 30_000;

/** Keep the client in component state; a server singleton would leak cache across requests. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Avoid immediately refetching server-prefetched data.
            staleTime: 60_000,
            retry: (failureCount, error) =>
              failureCount < 2 && isRetryable(error),
            // Retry-After wins over the backoff.
            retryDelay: (attempt, error) =>
              retryAfterOf(error) ??
              Math.min(1_000 * 2 ** attempt, MAX_BACKOFF_MS),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Check status by shape across bundles; network failures remain retryable.
function isRetryable(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return true;
  }

  const { status } = error;

  if (typeof status !== "number") {
    return true;
  }

  return status < 400 || status >= 500 || TRANSIENT_CLIENT_STATUSES.has(status);
}

function retryAfterOf(error: unknown): number | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("retryAfterMs" in error)
  ) {
    return undefined;
  }

  return typeof error.retryAfterMs === "number"
    ? error.retryAfterMs
    : undefined;
}
