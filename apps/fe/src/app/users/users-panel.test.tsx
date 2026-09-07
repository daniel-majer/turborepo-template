import {
  getUsersFindAllQueryKey,
  type UsersFindAll200,
} from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UsersPanel } from "./users-panel";

const fetchMock = vi.fn<typeof fetch>();
const ada = {
  id: 1,
  email: "ada@example.com",
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
};
const grace = {
  id: 2,
  email: "grace@example.com",
  createdAt: "2026-09-01T12:01:00.000Z",
  updatedAt: "2026-09-01T12:01:00.000Z",
};
const clients: QueryClient[] = [];

function page(data = [ada], nextCursor: number | null = null): UsersFindAll200 {
  return { data, meta: { nextCursor, hasNextPage: nextCursor !== null } };
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((resolveResponse) => {
    resolve = resolveResponse;
  });
  return { promise, resolve };
}

function mount(initialPage = page()) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  client.setQueryData(getUsersFindAllQueryKey(), initialPage);
  render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<p>Loading users…</p>}>
        <UsersPanel />
      </Suspense>
    </QueryClientProvider>,
  );
  return { client, user: userEvent.setup() };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
});

afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.length = 0;
});

describe("UsersPanel", () => {
  it("uses the SSR-prefetched first page without a duplicate request", () => {
    mount();

    expect(screen.getByText(ada.email)).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("Page 1");
    expect(
      screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Next" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates email before sending a mutation", async () => {
    const { user } = mount();

    await user.type(
      screen.getByRole("textbox", { name: "Email" }),
      "not-an-email",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByRole("alert").textContent).toMatch(/email/i);
    expect(
      screen
        .getByRole("textbox", { name: "Email" })
        .getAttribute("aria-invalid"),
    ).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes a new email, clears the input and refetches the list", async () => {
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST")
        return Response.json({ data: grace }, { status: 201 });
      return Response.json(page([ada, grace]));
    });
    const { user } = mount();

    await user.type(
      screen.getByRole("textbox", { name: "Email" }),
      "  GRACE@Example.com  ",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText(grace.email)).toBeDefined();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Email" })).toHaveProperty(
        "value",
        "",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: grace.email }),
      }),
    );
  });

  it("shows server mutation errors with their request ID", async () => {
    const requestId = "a61eb8df-5c8c-4bfb-8a22-908d30240e86";
    fetchMock.mockResolvedValue(
      Response.json(
        {
          data: null,
          error: {
            statusCode: 409,
            message: "Email already exists",
            timestamp: ada.createdAt,
            path: "/users",
            requestId,
          },
        },
        { status: 409 },
      ),
    );
    const { user } = mount();

    await user.type(screen.getByRole("textbox", { name: "Email" }), ada.email);
    await user.click(screen.getByRole("button", { name: "Add" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Email already exists");
    expect(alert.textContent).toContain(requestId);
  });

  it("removes a user and invalidates the paginated list", async () => {
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "DELETE") return Response.json({ data: ada });
      return Response.json(page([]));
    });
    const { user, client } = mount();

    await user.click(
      screen.getByRole("button", { name: `Remove ${ada.email}` }),
    );

    expect(await screen.findByText("No users yet.")).toBeDefined();
    expect(client.getQueryData(getUsersFindAllQueryKey())).toEqual(page([]));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/users/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("keeps a pending creation and its eventual error when removing another user", async () => {
    const createResponse = deferredResponse();
    const requestId = "a61eb8df-5c8c-4bfb-8a22-908d30240e86";
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") return createResponse.promise;
      if (options?.method === "DELETE") return Response.json({ data: ada });
      return Response.json(page([grace]));
    });
    const { user } = mount(page([ada, grace]));

    await user.type(
      screen.getByRole("textbox", { name: "Email" }),
      grace.email,
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add" })).toHaveProperty(
        "disabled",
        true,
      ),
    );

    await user.click(
      screen.getByRole("button", { name: `Remove ${ada.email}` }),
    );
    await waitFor(() => expect(screen.queryByText(ada.email)).toBeNull());
    expect
      .soft(screen.getByRole("button", { name: "Add" }))
      .toHaveProperty("disabled", true);

    createResponse.resolve(
      Response.json(
        {
          data: null,
          error: {
            statusCode: 409,
            message: "Email already exists",
            timestamp: ada.createdAt,
            path: "/users",
            requestId,
          },
        },
        { status: 409 },
      ),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Email already exists");
    expect(alert.textContent).toContain(requestId);
    expect(screen.getByRole("button", { name: "Add" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("keeps a pending removal and its eventual error when creating a user", async () => {
    const removeResponse = deferredResponse();
    const requestId = "ed0c4edc-e32a-4b5f-9b96-c7d87f67e65c";
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "DELETE") return removeResponse.promise;
      if (options?.method === "POST")
        return Response.json({ data: grace }, { status: 201 });
      return Response.json(page([ada, grace]));
    });
    const { user } = mount();

    await user.click(
      screen.getByRole("button", { name: `Remove ${ada.email}` }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Remove ${ada.email}` }),
      ).toHaveProperty("disabled", true),
    );

    await user.type(
      screen.getByRole("textbox", { name: "Email" }),
      grace.email,
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(grace.email)).toBeDefined();
    expect
      .soft(screen.getByRole("button", { name: `Remove ${ada.email}` }))
      .toHaveProperty("disabled", true);
    expect
      .soft(screen.getByRole("button", { name: `Remove ${grace.email}` }))
      .toHaveProperty("disabled", true);

    removeResponse.resolve(
      Response.json(
        {
          data: null,
          error: {
            statusCode: 503,
            message: "Database unavailable",
            timestamp: ada.createdAt,
            path: "/users/1",
            requestId,
          },
        },
        { status: 503 },
      ),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Database unavailable");
    expect(alert.textContent).toContain(requestId);
    expect(screen.getByText(ada.email)).toBeDefined();
    expect(
      screen.getByRole("button", { name: `Remove ${ada.email}` }),
    ).toHaveProperty("disabled", false);
  });

  it("ignores form submissions while a creation is pending", async () => {
    const createResponse = deferredResponse();
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") return createResponse.promise;
      return Response.json(page([ada, grace]));
    });
    const { user } = mount();

    await user.type(
      screen.getByRole("textbox", { name: "Email" }),
      grace.email,
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    await user.click(addButton);
    await waitFor(() => expect(addButton).toHaveProperty("disabled", true));

    fireEvent.submit(addButton.closest("form")!);
    createResponse.resolve(Response.json({ data: grace }, { status: 201 }));

    expect(await screen.findByText(grace.email)).toBeDefined();
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(1);
  });

  it("keeps the list and reports a failed removal", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          data: null,
          error: {
            statusCode: 503,
            message: "Database unavailable",
            timestamp: ada.createdAt,
            path: "/users/1",
            requestId: "a61eb8df-5c8c-4bfb-8a22-908d30240e86",
          },
        },
        { status: 503 },
      ),
    );
    const { user } = mount();

    await user.click(
      screen.getByRole("button", { name: `Remove ${ada.email}` }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Database unavailable",
    );
    expect(screen.getByText(ada.email)).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("navigates with server cursors and restores the previous cached page", async () => {
    fetchMock.mockResolvedValue(Response.json(page([grace])));
    const { user } = mount(page([ada], ada.id));

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText(grace.email)).toBeDefined();
    expect(screen.queryByText(ada.email)).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Page 2");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/users?cursor=1",
      expect.anything(),
    );
    expect(
      screen.getByRole("button", { name: "Next" }).hasAttribute("disabled"),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(await screen.findByText(ada.email)).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("Page 1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows returning from a page emptied by a concurrent deletion", async () => {
    fetchMock.mockResolvedValue(Response.json(page([])));
    const { user } = mount(page([ada], ada.id));

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("No users on this page.")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Next" }).hasAttribute("disabled"),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(await screen.findByText(ada.email)).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("Page 1");
  });
});
