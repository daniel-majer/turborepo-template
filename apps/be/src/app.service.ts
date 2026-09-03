import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

import { CacheService } from "./cache/cache.service.js";

const HELLO_CACHE_KEY = "hello";
const HELLO_CACHE_TTL_MS = 10_000;

@Injectable()
export class AppService {
  constructor(
    @InjectPinoLogger(AppService.name) private readonly logger: PinoLogger,
    private readonly cache: CacheService,
  ) {}

  getHello(): Promise<string> {
    return this.cache.wrap(
      HELLO_CACHE_KEY,
      () => {
        this.logger.info("Cache miss, building hello message");
        return "Hello World!";
      },
      HELLO_CACHE_TTL_MS,
    );
  }
}
