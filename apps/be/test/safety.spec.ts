import { assertSafeTestTargets } from "./safety.js";

const testFileEnvironment = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/app_test",
  REDIS_URL: "redis://localhost:6380",
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
    };

    expect(() =>
      assertSafeTestTargets(
        { ...unsafeEnvironment, NODE_ENV: "test" },
        unsafeEnvironment,
      ),
    ).toThrow(/must end with/);
  });
});
