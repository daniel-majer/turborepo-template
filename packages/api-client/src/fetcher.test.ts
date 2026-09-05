import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, fetcher, NETWORK_ERROR_STATUS } from "./fetcher";

const fetchMock = vi.fn<typeof fetch>();
const requestId = "a61eb8df-5c8c-4bfb-8a22-908d30240e86";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", undefined);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/gateway/");
  vi.stubEnv("API_URL", undefined);
});

describe("API addresses", () => {
  it("preserves proxy paths and query parameters", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [] }));

    await fetcher("/users?take=20&cursor=10");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/gateway/users?take=20&cursor=10",
      { credentials: "include" },
    );
  });

  it("uses the private API address only on the server", async () => {
    vi.stubEnv("API_URL", "http://api:3001/");
    fetchMock.mockImplementation(async () => Response.json({ data: [] }));

    await fetcher("users");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api:3001/users");

    vi.stubGlobal("window", {});
    await fetcher("users");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://example.com/gateway/users",
    );
  });

  it.each([
    undefined,
    "",
    "/api",
    "ftp://example.com",
    "https://user:secret@example.com",
    "https://example.com?token=secret",
    "https://example.com#api",
  ])("rejects invalid public API configuration: %s", async (base) => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", base);
    vi.stubEnv("API_URL", "http://api:3001");

    await expect(fetcher("/users")).rejects.toThrow("NEXT_PUBLIC_API_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing public base in the browser without requesting frontend routes", async () => {
    vi.stubGlobal("window", {});
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    await expect(fetcher("/users")).rejects.toThrow("NEXT_PUBLIC_API_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid server overrides", async () => {
    vi.stubEnv("API_URL", "api:3001");

    await expect(fetcher("/users")).rejects.toThrow("API_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("responses", () => {
  it("preserves envelopes and request options", async () => {
    const payload = {
      data: [],
      meta: { nextCursor: null, hasNextPage: false },
    };
    const options = {
      method: "POST",
      body: "{}",
      credentials: "omit" as const,
    };
    fetchMock.mockResolvedValue(Response.json(payload));

    await expect(fetcher("/users", options)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/gateway/users",
      options,
    );
  });

  it("returns null for a no-content response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(fetcher("/users/1", { method: "DELETE" })).resolves.toBeNull();
  });

  it.each(["<html>Frontend page</html>", "{}", "null", "[]"])(
    "rejects successful responses without an envelope: %s",
    async (body) => {
      fetchMock.mockResolvedValue(
        new Response(body, { headers: { "x-request-id": requestId } }),
      );

      await expect(fetcher("/users")).rejects.toMatchObject({
        status: 200,
        error: {
          message: expect.stringContaining("response envelope"),
          requestId,
        },
      });
    },
  );

  it("preserves backend validation errors and correlation IDs", async () => {
    const error = {
      statusCode: 400,
      message: "Validation failed",
      details: ["email must be an email"],
      timestamp: "2026-09-01T12:00:00.000Z",
      path: "/users",
      requestId,
    };
    fetchMock.mockResolvedValue(
      Response.json({ data: null, error }, { status: 400 }),
    );

    await expect(fetcher("/users")).rejects.toMatchObject({
      status: 400,
      data: null,
      error,
    });
  });

  it("preserves proxy status and request ID without a JSON envelope", async () => {
    fetchMock.mockResolvedValue(
      new Response("Bad gateway", {
        status: 502,
        headers: { "x-request-id": requestId },
      }),
    );

    await expect(fetcher("/users")).rejects.toMatchObject({
      status: 502,
      error: { statusCode: 502, path: "/users", requestId },
    });
  });

  it("normalizes malformed error envelopes", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { message: "Incomplete" } }, { status: 500 }),
    );

    await expect(fetcher("/users")).rejects.toMatchObject({
      status: 500,
      error: {
        statusCode: 500,
        message: "Request failed with status 500",
        path: "/users",
      },
    });
  });

  it("normalizes network failures without inventing a request ID", async () => {
    const cause = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValue(cause);

    const error = await fetcher("/users").catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: NETWORK_ERROR_STATUS, cause });
    expect(error).not.toHaveProperty("error.requestId");
  });
});

describe("Retry-After", () => {
  it.each([
    ["2", 2_000],
    ["-1", 0],
    ["invalid", undefined],
    ["", undefined],
  ])("parses %s as %s milliseconds", async (header, milliseconds) => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 429, headers: { "retry-after": header } }),
    );

    await expect(fetcher("/users")).rejects.toMatchObject({
      retryAfterMs: milliseconds,
    });
  });

  it("supports HTTP dates", async () => {
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-09-01T12:00:00.000Z"),
    );
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 503,
        headers: { "retry-after": "Tue, 01 Sep 2026 12:00:05 GMT" },
      }),
    );

    await expect(fetcher("/users")).rejects.toMatchObject({
      retryAfterMs: 5_000,
    });
  });
});
