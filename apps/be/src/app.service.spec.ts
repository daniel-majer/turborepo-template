import { createMock, DeepMocked } from "@golevelup/ts-vitest";
import { Test } from "@nestjs/testing";
import { getLoggerToken, PinoLogger } from "nestjs-pino";

import { AppService } from "./app.service.js";
import { CacheService } from "./cache/cache.service.js";

describe("AppService", () => {
  let service: AppService;
  let cache: DeepMocked<CacheService>;
  let logger: DeepMocked<PinoLogger>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AppService],
    })
      .useMocker(() => createMock())
      .compile();

    service = moduleRef.get(AppService);
    cache = moduleRef.get(CacheService);
    logger = moduleRef.get(getLoggerToken(AppService.name));
  });

  describe("getHello", () => {
    it("builds the message on a cache miss", async () => {
      cache.wrap.mockImplementation(async (_key, factory) => factory());

      await expect(service.getHello()).resolves.toBe("Hello World!");
      expect(logger.info.mock.calls).toHaveLength(1);
    });

    it("returns the cached message without rebuilding it", async () => {
      cache.wrap.mockResolvedValue("VALUE FROM CACHE");

      await expect(service.getHello()).resolves.toBe("VALUE FROM CACHE");
      expect(logger.info.mock.calls).toHaveLength(0);
    });

    it("caches under the hello key with a ttl", async () => {
      cache.wrap.mockResolvedValue("Hello World!");

      await service.getHello();

      expect(cache.wrap.mock.calls).toEqual([
        ["hello", expect.any(Function), 10_000],
      ]);
    });
  });
});
