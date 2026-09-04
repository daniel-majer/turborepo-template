import { readFileSync } from "node:fs";

import { parse } from "dotenv";

type Environment = Readonly<Record<string, string | undefined>>;

/** Refuses destructive cleanup unless both services match the local test config. */
export function assertSafeTestTargets(
  runtimeEnv: Environment = process.env,
  testFileEnv: Environment = loadTestFileEnv(),
): void {
  if (runtimeEnv.NODE_ENV !== "test") {
    throw new Error("Refusing test cleanup: NODE_ENV must be test");
  }

  const database = readUrl(runtimeEnv, "DATABASE_URL");
  const redis = readUrl(runtimeEnv, "REDIS_URL");
  const expectedDatabase = readUrl(testFileEnv, "DATABASE_URL");
  const expectedRedis = readUrl(testFileEnv, "REDIS_URL");

  if (
    database.href !== expectedDatabase.href ||
    redis.href !== expectedRedis.href
  ) {
    throw new Error(
      "Refusing test cleanup: service URLs do not match .env.test",
    );
  }

  if (!isLoopback(database.hostname) || !isLoopback(redis.hostname)) {
    throw new Error("Refusing test cleanup: services must use localhost");
  }

  const databaseName = decodeURIComponent(database.pathname.slice(1));
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      'Refusing test cleanup: database name must end with "_test"',
    );
  }
}

function readUrl(environment: Environment, name: string): URL {
  const value = environment[name];
  if (!value) {
    throw new Error(`Refusing test cleanup: ${name} is missing`);
  }

  try {
    return new URL(value);
  } catch {
    throw new Error(`Refusing test cleanup: ${name} is invalid`);
  }
}

function loadTestFileEnv(): Environment {
  return parse(readFileSync(new URL("../.env.test", import.meta.url)));
}

function isLoopback(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    hostname.toLowerCase(),
  );
}
