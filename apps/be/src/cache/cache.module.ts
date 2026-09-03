import { createKeyv } from "@keyv/redis";
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { Global, Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { redisConfig } from "../config/index.js";
import { CacheService } from "./cache.service.js";

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => ({
        stores: [createKeyv(config.url)],
        ttl: 5_000, // ms
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
