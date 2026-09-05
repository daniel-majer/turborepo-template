import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SKIP_ENV_VALIDATION", "true");
});

describe("mandatory public API address", () => {
  it.each([undefined, "", "/api", "ftp://api.example.com"])(
    "rejects %s even when build-time validation is skipped",
    async (url) => {
      vi.stubEnv("NEXT_PUBLIC_API_URL", url);
      await expect(import("./env")).rejects.toThrow("NEXT_PUBLIC_API_URL");
    },
  );

  it("accepts an explicit reverse-proxy base", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/gateway");
    const { env } = await import("./env");
    expect(env.NEXT_PUBLIC_API_URL).toBe("https://example.com/gateway");
  });
});
