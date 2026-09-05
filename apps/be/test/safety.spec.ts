import { assertSafeTestTargets } from "./safety.js";

const testFileEnvironment = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/app_test",
  REDIS_URL: "redis://localhost:6380",
  CACHE_NAMESPACE: "app-test",
};

const runtimeEnvironment = {
  ...testFileEnvironment,
  NODE_ENV: "test",
};

describe("test cleanup target safety", () => {
  it("accepts the committed local test targets", () => {
    expect(() =>
      assertSafeTestTargets(runtimeEnvironment, testFileEnvironment),
    ).not.toThrow();
  });

  it("rejects cleanup outside NODE_ENV=test", () => {
    expect(() =>
      assertSafeTestTargets(
        { ...runtimeEnvironment, NODE_ENV: "production" },
        testFileEnvironment,
      ),
    ).toThrow(/NODE_ENV must be test/);
  });

  it("rejects a URL that differs from .env.test", () => {
    expect(() =>
      assertSafeTestTargets(
        {
          ...runtimeEnvironment,
          DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/app",
        },
        testFileEnvironment,
      ),
    ).toThrow(/do not match/);
  });

  it("rejects non-local services", () => {
    const remoteEnvironment = {
      DATABASE_URL:
        "postgresql://postgres:postgres@db.example.com:5434/app_test",
      REDIS_URL: "redis://cache.example.com:6380",
      CACHE_NAMESPACE: "app-test",
    };

    expect(() =>
      assertSafeTestTargets(
        { ...remoteEnvironment, NODE_ENV: "test" },
        remoteEnvironment,
      ),
    ).toThrow(/must use localhost/);
  });

  it('requires a database name ending with "_test"', () => {
    const unsafeEnvironment = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/app",
      REDIS_URL: "redis://localhost:6380",
      CACHE_NAMESPACE: "app-test",
    };

    expect(() =>
      assertSafeTestTargets(
        { ...unsafeEnvironment, NODE_ENV: "test" },
        unsafeEnvironment,
      ),
    ).toThrow(/must end with/);
  });

  it("rejects a cache namespace that differs from .env.test", () => {
    expect(() =>
      assertSafeTestTargets(
        { ...runtimeEnvironment, CACHE_NAMESPACE: "app" },
        testFileEnvironment,
      ),
    ).toThrow(/CACHE_NAMESPACE does not match/);
  });

  it('requires a cache namespace ending with "-test"', () => {
    const unsafeEnvironment = {
      ...testFileEnvironment,
      CACHE_NAMESPACE: "app",
    };

    expect(() =>
      assertSafeTestTargets(
        { ...unsafeEnvironment, NODE_ENV: "test" },
        unsafeEnvironment,
      ),
    ).toThrow(/must end with "-test"/);
  });

  it.each([
    "app*-test",
    "app?-test",
    "app[ab]-test",
    "app\\-test",
    "app::other-test",
    "app test-test",
  ])("rejects unsafe cache namespace %s before cleanup", (namespace) => {
    const environment = { ...testFileEnvironment, CACHE_NAMESPACE: namespace };
    expect(() =>
      assertSafeTestTargets({ ...environment, NODE_ENV: "test" }, environment),
    ).toThrow(/unsafe characters/);
  });
});
