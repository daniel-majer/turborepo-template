import { Test } from "@nestjs/testing";

import { AppModule } from "./../src/app.module.js";
import { CacheService } from "./../src/cache/cache.service.js";

// Runs against the Redis from docker-compose, the same way the other e2e
// tests run against Postgres.
describe("CacheService (e2e)", () => {
  let cache: CacheService;
  let close: () => Promise<void>;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.useLogger(false);
    await app.init();

    cache = app.get(CacheService);
    await cache.clear();
    close = () => app.close();
  });

  afterEach(async () => {
    await cache.clear();
    await close();
  });

  it("stores and reads back an object", async () => {
    await cache.set("user:1", { id: 1, name: "Ada" }, 5_000);

    await expect(cache.get("user:1")).resolves.toEqual({ id: 1, name: "Ada" });
  });

  it("returns undefined for a missing key", async () => {
    await expect(cache.get("missing")).resolves.toBeUndefined();
  });

  it("expires a value after its ttl", async () => {
    await cache.set("short", "x", 50);

    await expect(cache.get("short")).resolves.toBe("x");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(cache.get("short")).resolves.toBeUndefined();
  });

  it("del removes a key", async () => {
    await cache.set("gone", 1, 5_000);

    await cache.del("gone");

    await expect(cache.get("gone")).resolves.toBeUndefined();
  });

  it("clear removes every key", async () => {
    await cache.set("a", 1, 5_000);
    await cache.set("b", 2, 5_000);

    await cache.clear();

    await expect(cache.get("a")).resolves.toBeUndefined();
    await expect(cache.get("b")).resolves.toBeUndefined();
  });

  it("wrap calls the factory only on a miss", async () => {
    const factory = vi.fn(async () => "computed");

    const first = await cache.wrap("wrapped", factory, 5_000);
    const second = await cache.wrap("wrapped", factory, 5_000);

    expect(first).toBe("computed");
    expect(second).toBe("computed");
    expect(factory).toHaveBeenCalledOnce();
  });

  it("survives a new application instance (data lives in Redis, not in memory)", async () => {
    await cache.set("persistent", "still here", 5_000);
    await close();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleFixture.createNestApplication();
    app.useLogger(false);
    await app.init();
    cache = app.get(CacheService);
    close = () => app.close();

    await expect(cache.get("persistent")).resolves.toBe("still here");
  });
});
