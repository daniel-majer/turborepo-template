import { createKeyv } from "@keyv/redis";
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { Global, Logger, Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { redisConfig } from "../config/index.js";
import { CacheService } from "./cache.service.js";

const CACHE_TTL_MS = 5_000;

// Fail fast when Redis is unavailable.
const CONNECT_TIMEOUT_MS = 500;
const RECONNECT_MAX_DELAY_MS = 5_000;

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => {
        const logger = new Logger("CacheModule");

        // Use <namespace>::<key> keys and propagate write/invalidation errors.
        const store = createKeyv(
          {
            url: config.url,
            // Reject commands while offline instead of holding up requests.
            disableOfflineQueue: true,
            socket: {
              connectTimeout: CONNECT_TIMEOUT_MS,
              // Bounded backoff; `false` would stop reconnecting for good.
              reconnectStrategy: (retries: number) =>
                Math.min(2 ** retries * 50, RECONNECT_MAX_DELAY_MS),
            },
          },
          {
            namespace: config.namespace,
            connectionTimeout: CONNECT_TIMEOUT_MS,
            throwOnConnectError: true,
            throwOnErrors: true,
          },
        );

        // Handle Redis errors without crashing the process.
        store.on("error", (error: unknown) => {
          logger.error(error, "redis cache error");
        });

        return { stores: [store], ttl: CACHE_TTL_MS };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
