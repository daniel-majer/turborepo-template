import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import { CacheService } from "../src/cache/cache.service.js";
import { cacheNamespaceSchema } from "../src/config/env.js";
import { redisConfig } from "../src/config/index.js";
import { assertSafeTestTargets } from "./safety.js";
import { useTestApp } from "./setup.js";

describe("CacheService (integration)", () => {
  const t = useTestApp();

  it("stores and reads back an object", async () => {
    await t.cache.set("user:1", { id: 1, name: "Ada" }, 5_000);

    await expect(t.cache.get("user:1")).resolves.toEqual({
      id: 1,
      name: "Ada",
    });
  });

  it("returns undefined for a missing key", async () => {
    await expect(t.cache.get("missing")).resolves.toBeUndefined();
  });

  it("expires a value after its ttl", async () => {
    await t.cache.set("short", "x", 50);

    await expect(t.cache.get("short")).resolves.toBe("x");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(t.cache.get("short")).resolves.toBeUndefined();
  });

  it("del removes a key", async () => {
    await t.cache.set("gone", 1, 5_000);

    await t.cache.del("gone");

    await expect(t.cache.get("gone")).resolves.toBeUndefined();
  });

  it("clear removes every key", async () => {
    await t.cache.set("a", 1, 5_000);
    await t.cache.set("b", 2, 5_000);

    await t.cache.clear();

    await expect(t.cache.get("a")).resolves.toBeUndefined();
    await expect(t.cache.get("b")).resolves.toBeUndefined();
  });

  it("clear preserves a neighboring namespace on the same Redis server", async () => {
    assertSafeTestTargets();
    const config = t.app.get<ConfigType<typeof redisConfig>>(redisConfig.KEY);
    const namespace = cacheNamespaceSchema.parse(
      `${config.namespace}-sibling-test`,
    );
    const sibling = createKeyv(config.url, { namespace, throwOnErrors: true });
    const key = randomUUID();
    try {
      await sibling.set(key, "neighbor", 60_000);
      await t.cache.set(key, "own", 60_000);
      await t.cache.clear();
      await expect(t.cache.get(key)).resolves.toBeUndefined();
      await expect(sibling.get(key)).resolves.toBe("neighbor");
    } finally {
      try {
        await sibling.delete(key);
      } finally {
        await sibling.disconnect();
      }
    }
  });

  it("wrap calls the factory only on a miss", async () => {
    const factory = vi.fn(async () => "computed");

    const first = await t.cache.wrap("wrapped", factory, 5_000);
    const second = await t.cache.wrap("wrapped", factory, 5_000);

    expect(first).toBe("computed");
    expect(second).toBe("computed");
    expect(factory).toHaveBeenCalledOnce();
  });

  it("is shared across application instances (lives in Redis, not in memory)", async () => {
    await t.cache.set("persistent", "still here", 5_000);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const other = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await other.init();
    try {
      await expect(other.get(CacheService).get("persistent")).resolves.toBe(
        "still here",
      );
    } finally {
      await other.close();
    }
  });
});
import { randomUUID } from "node:crypto";

import { createKeyv } from "@keyv/redis";
import type { ConfigType } from "@nestjs/config";
