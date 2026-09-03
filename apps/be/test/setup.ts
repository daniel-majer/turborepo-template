import type { ModuleMetadata } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { CacheService } from "../src/cache/cache.service.js";
import { DatabaseService } from "../src/database/database.service.js";

export interface TestApp {
  app: NestFastifyApplication;
  db: DatabaseService;
  cache: CacheService;
}

/**
 * Boots the real AppModule (Docker Postgres + Redis from .env.test) once per
 * test file, configured exactly like main.ts, and wipes the database and
 * cache after every test. Extra controllers/providers for the test can be
 * passed as module metadata.
 *
 *   const t = useTestApp();
 *   it("...", async () => { const res = await t.app.inject({ ... }); });
 */
export function useTestApp(metadata: ModuleMetadata = {}): TestApp {
  const state: Partial<TestApp> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      ...metadata,
      imports: [AppModule, ...(metadata.imports ?? [])],
    }).compile();

    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    state.app = app;
    state.db = app.get(DatabaseService);
    state.cache = app.get(CacheService);
  });

  afterEach(async () => {
    await resetDatabase(ready(state.db, "db"));
    await ready(state.cache, "cache").clear();
  });

  afterAll(async () => {
    await state.app?.close();
  });

  // Getters so a test that reads `t.app` before beforeAll ran fails loudly
  // instead of with "cannot read property of undefined".
  return {
    get app() {
      return ready(state.app, "app");
    },
    get db() {
      return ready(state.db, "db");
    },
    get cache() {
      return ready(state.cache, "cache");
    },
  };
}

function ready<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`Test app is not ready yet: "${name}" is unavailable`);
  }
  return value;
}

/** Truncates every table in the public schema except Prisma's migration log. */
export async function resetDatabase(db: DatabaseService) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetDatabase() may only run with NODE_ENV=test");
  }

  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
