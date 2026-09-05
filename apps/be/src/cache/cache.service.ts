import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Cache } from "cache-manager";

const PROBE_KEY = "__boot_probe__";

/**
 * Shared cache keyspace; durations are milliseconds.
 * Use null for cached absence: undefined is always a miss.
 */
@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);

  // Deduplicate concurrent factories per key.
  private readonly inFlight = new Map<string, Promise<unknown>>();

  // Prevent invalidated factories from caching stale results.
  private readonly invalidatedInFlight = new Set<string>();

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  // Store errors become misses and are logged via the get event.
  async get<T>(key: string): Promise<T | undefined> {
    return await this.cache.get<T>(key);
  }

  // Reject zero TTL: Keyv treats it as never expiring.
  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    assertPositiveTtl(ttlMs);
    this.noteInvalidation(key);

    await this.cache.set(key, value, ttlMs);
  }

  // Propagate failed invalidations.
  async del(key: string): Promise<void> {
    // Invalidate before awaiting Redis to prevent a factory race.
    this.noteInvalidation(key);

    await this.cache.del(key);
  }

  // Delete only keys under CACHE_NAMESPACE.
  async clear(): Promise<void> {
    for (const key of this.inFlight.keys()) {
      this.invalidatedInFlight.add(key);
    }

    // Rethrow clear() errors: @keyv/redis only emits them.
    let failure: unknown;
    const collect = (error: unknown) => {
      failure ??= error;
    };

    for (const store of this.cache.stores) {
      store.on("error", collect);
    }

    try {
      await this.cache.clear();
    } finally {
      for (const store of this.cache.stores) {
        store.off("error", collect);
      }
    }

    if (failure !== undefined) {
      throw failure;
    }
  }

  /**
   * Share one factory per key; cache failures serve uncached data.
   * Concurrent set/del/clear suppresses the factory's cache write.
   */
  async wrap<T>(
    key: string,
    factory: () => T | Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    // Reject invalid TTLs before the cache-write error handler.
    assertPositiveTtl(ttlMs);

    const hit = await this.read<T>(key);

    if (hit !== undefined) {
      return hit;
    }

    const pending = this.inFlight.get(key);

    if (pending) {
      // The caller's T is the only type information a key has.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return (await pending) as T;
    }

    const run = (async () => {
      const value = await factory();

      if (value !== undefined && !this.invalidatedInFlight.has(key)) {
        try {
          // Bypass set(): a cache-aside write must not invalidate pending factories.
          await this.cache.set(key, value, ttlMs);
        } catch (error) {
          this.logger.warn(
            error,
            `cache write failed for "${key}" - serving it uncached`,
          );
        }
      }

      return value;
    })();

    this.inFlight.set(key, run);

    try {
      return await run;
    } finally {
      this.inFlight.delete(key);
      this.invalidatedInFlight.delete(key);
    }
  }

  async onModuleInit() {
    // Read failures arrive as events, not rejections.
    this.cache.on("get", ({ key, error }) => {
      if (error !== undefined) {
        this.logger.warn(
          error,
          `cache read failed for "${key}" - treating it as a miss`,
        );
      }
    });

    // Redis failure must not prevent startup.
    try {
      await this.cache.set(PROBE_KEY, true, 1_000);
      await this.cache.del(PROBE_KEY);
    } catch (error) {
      this.logger.error(
        error,
        "cache backend unreachable - responses will not be cached",
      );
    }
  }

  private noteInvalidation(key: string) {
    if (this.inFlight.has(key)) {
      this.invalidatedInFlight.add(key);
    }
  }

  // Handle direct stores that reject instead of returning a miss.
  private async read<T>(key: string): Promise<T | undefined> {
    try {
      return await this.get<T>(key);
    } catch (error) {
      this.logger.warn(
        error,
        `cache read failed for "${key}" - treating it as a miss`,
      );

      return undefined;
    }
  }
}

function assertPositiveTtl(ttlMs: number | undefined) {
  if (ttlMs !== undefined && ttlMs <= 0) {
    throw new Error(
      `cache ttl must be a positive number of milliseconds, got ${ttlMs}`,
    );
  }
}
