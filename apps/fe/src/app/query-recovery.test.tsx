import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ErrorBoundaryHandler } from "next/dist/client/components/error-boundary";
import { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";

import RootError from "./error";
import { Providers } from "./providers";
import UsersError from "./users/error";
import { UsersPanel } from "./users/users-panel";

afterEach(cleanup);

it.each([
  ["users", UsersError],
  ["root", RootError],
])(
  "retries an API outage through the %s error boundary until recovery",
  async (_name, ErrorComponent) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json(
        { message: "Temporary API outage" },
        {
          status: 503,
          // Exercise the real retry policy without waiting for exponential backoff.
          headers: { "Retry-After": "0" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");

    render(
      <Providers>
        {/* Use Next's boundary so recovery preserves the provider and its failed query. */}
        <ErrorBoundaryHandler
          pathname="/users"
          errorComponent={({ error, retry }) => {
            if (!(error instanceof Error)) {
              throw new Error("Expected an API error", { cause: error });
            }
            return <ErrorComponent error={error} retry={retry} />;
          }}
        >
          <Suspense fallback={<p>Loading users…</p>}>
            <UsersPanel />
          </Suspense>
        </ErrorBoundaryHandler>
      </Providers>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    // The API is still unavailable; a manual retry must make new requests.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
    const retryButton = await screen.findByRole("button", {
      name: "Try again",
    });

    fetchMock.mockImplementation(async () =>
      Response.json({
        data: [],
        meta: { nextCursor: null, hasNextPage: false },
      }),
    );
    fireEvent.click(retryButton);

    expect(await screen.findByText("No users yet.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(7);
  },
);
