import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import type { Cache } from "cache-manager";

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttlMs?: number): Promise<T> {
    return this.cache.set(key, value, ttlMs);
  }

  del(key: string): Promise<boolean> {
    return this.cache.del(key);
  }

  clear(): Promise<boolean> {
    return this.cache.clear();
  }

  wrap<T>(key: string, fn: () => T | Promise<T>, ttlMs?: number): Promise<T> {
    return this.cache.wrap(key, fn, ttlMs);
  }
}
