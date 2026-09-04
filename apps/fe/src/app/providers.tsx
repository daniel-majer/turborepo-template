"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * One QueryClient per browser tab, created lazily inside state.
 *
 * A module-level `new QueryClient()` would be shared by every request the
 * server renders, leaking one visitor's cache into the next one's page.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data prefetched on the server is fresh on arrival; without this
            // every hook refetches immediately on mount and the prefetch was
            // wasted work.
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
