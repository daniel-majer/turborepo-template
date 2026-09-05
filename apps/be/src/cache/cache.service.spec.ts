import { createMock, type DeepMocked } from "@golevelup/ts-vitest";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Cache } from "cache-manager";
import type { Keyv } from "keyv";

import { CacheService } from "./cache.service.js";

describe("CacheService", () => {
  let service: CacheService;
  let cache: DeepMocked<Cache>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CacheService,
        // clear() needs an iterable store list.
        { provide: CACHE_MANAGER, useValue: createMock<Cache>({ stores: [] }) },
      ],
    }).compile();

    service = moduleRef.get(CacheService);
    cache = moduleRef.get(CACHE_MANAGER);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("set", () => {
    it("passes the ttl through unchanged", async () => {
      await service.set("k", "v", 1_000);

      expect(cache.set.mock.calls).toEqual([["k", "v", 1_000]]);
    });

    it("rejects ttl 0, which keyv would silently store forever", async () => {
      await expect(service.set("k", "v", 0)).rejects.toThrow(/positive number/);
      expect(cache.set.mock.calls).toHaveLength(0);
    });

    it("rejects a negative ttl", async () => {
      await expect(service.set("k", "v", -1)).rejects.toThrow(
        /positive number/,
      );
    });

    it("allows an omitted ttl so the module default applies", async () => {
      await service.set("k", "v");

      expect(cache.set.mock.calls).toEqual([["k", "v", undefined]]);
    });
  });

  describe("wrap", () => {
    it("returns the cached value without running the factory", async () => {
      cache.get.mockResolvedValue(42);
      const factory = vi.fn();

      await expect(service.wrap("k", factory)).resolves.toBe(42);
      expect(factory.mock.calls).toHaveLength(0);
    });

    it("stores what the factory returned, exactly as set() would", async () => {
      cache.get.mockResolvedValue(undefined);

      await expect(
        service.wrap("k", async () => ({ id: 1 }), 1_000),
      ).resolves.toEqual({ id: 1 });
      expect(cache.set.mock.calls).toEqual([["k", { id: 1 }, 1_000]]);
    });

    it("accepts a synchronous factory", async () => {
      cache.get.mockResolvedValue(undefined);

      await expect(service.wrap("k", () => "plain")).resolves.toBe("plain");
      expect(cache.set.mock.calls).toEqual([["k", "plain", undefined]]);
    });

    it("does not store undefined, which would read back as a miss", async () => {
      cache.get.mockResolvedValue(undefined);

      await expect(
        service.wrap("k", async () => undefined),
      ).resolves.toBeUndefined();
      expect(cache.set.mock.calls).toHaveLength(0);
    });

    it("runs the factory once for concurrent calls on the same key", async () => {
      cache.get.mockResolvedValue(undefined);
      const factory = vi.fn(async () => "value");

      const results = await Promise.all([
        service.wrap("k", factory),
        service.wrap("k", factory),
      ]);

      expect(results).toEqual(["value", "value"]);
      expect(factory.mock.calls).toHaveLength(1);
    });

    it("serves the value when the store cannot be read", async () => {
      // Cover direct stores that reject reads instead of returning misses.
      const warn = vi
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);
      cache.get.mockRejectedValue(new Error("redis unreachable"));

      await expect(service.wrap("k", async () => "from factory")).resolves.toBe(
        "from factory",
      );
      expect(warn.mock.calls).toHaveLength(1);
    });

    it("rejects a non-positive ttl instead of logging it as a failed write", async () => {
      cache.get.mockResolvedValue(undefined);
      const factory = vi.fn();

      await expect(service.wrap("k", factory, 0)).rejects.toThrow(
        /positive number/,
      );
      expect(factory.mock.calls).toHaveLength(0);
    });

    it("does not store a value that was invalidated while the factory ran", async () => {
      cache.get.mockResolvedValue(undefined);
      const started = deferred();
      const finish = deferred();
      const factory = async () => {
        started.resolve();
        await finish.promise;

        return "read before the write";
      };

      const reading = service.wrap("k", factory);
      await started.promise;
      await service.del("k");
      finish.resolve();

      await expect(reading).resolves.toBe("read before the write");
      expect(cache.set.mock.calls).toHaveLength(0);
    });

    it("serves the value when the store cannot be written", async () => {
      const warn = vi
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);
      cache.get.mockResolvedValue(undefined);
      cache.set.mockRejectedValue(new Error("redis unreachable"));

      await expect(service.wrap("k", async () => "from factory")).resolves.toBe(
        "from factory",
      );
      expect(warn.mock.calls).toHaveLength(1);
    });
  });

  describe("del and clear", () => {
    it("delegates del", async () => {
      await service.del("k");

      expect(cache.del.mock.calls).toEqual([["k"]]);
    });

    it("propagates a store failure instead of reporting success", async () => {
      cache.del.mockRejectedValue(new Error("redis unreachable"));

      await expect(service.del("k")).rejects.toThrow("redis unreachable");
    });

    it("delegates clear", async () => {
      await service.clear();

      expect(cache.clear.mock.calls).toHaveLength(1);
    });

    it("reports a wipe the store swallowed instead of resolving", async () => {
      // Simulate @keyv/redis emitting a clear error without rejecting.
      const listeners = new Set<(error: unknown) => void>();
      const store = {
        on: (_event: string, listener: (error: unknown) => void) =>
          listeners.add(listener),
        off: (_event: string, listener: (error: unknown) => void) =>
          listeners.delete(listener),
      };
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      cache.stores.push(store as unknown as Keyv);
      cache.clear.mockImplementation(async () => {
        for (const listener of listeners) {
          listener(new Error("redis unreachable"));
        }

        return true;
      });

      await expect(service.clear()).rejects.toThrow("redis unreachable");
      expect(listeners.size).toBe(0);
    });
  });

  describe("onModuleInit", () => {
    it("probes the backend with a round trip", async () => {
      await service.onModuleInit();

      expect(cache.set.mock.calls).toHaveLength(1);
      expect(cache.del.mock.calls).toHaveLength(1);
    });

    it("logs and continues when the backend is unreachable", async () => {
      const error = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      cache.set.mockRejectedValue(new Error("redis unreachable"));

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(error.mock.calls).toHaveLength(1);
    });
  });
});

// Control factory timing for race-condition tests.
function deferred() {
  // Assigned synchronously by the executor.
  let settle!: () => void;
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });

  return { promise, resolve: () => settle() };
}
