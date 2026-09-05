import { cacheNamespaceSchema, validateEnv } from "./env.js";

describe("cache namespace validation", () => {
  it.each(["app", "project-prod_1", "APP-42"])("accepts %s", (namespace) => {
    expect(cacheNamespaceSchema.parse(namespace)).toBe(namespace);
  });

  it.each([
    "",
    "app*",
    "app?",
    "app[12]",
    "app\\name",
    "app::other",
    "app:name",
    "app name",
    "app\n",
  ])("rejects %j at application startup", (namespace) => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://localhost/app",
        REDIS_URL: "redis://localhost",
        CACHE_NAMESPACE: namespace,
      }),
    ).toThrow(/CACHE_NAMESPACE/);
  });
});
