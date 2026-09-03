import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Test } from "@nestjs/testing";

import { CacheService } from "./cache.service.js";

describe("CacheService", () => {
  let service: CacheService;
  let manager: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    wrap: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    manager = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      clear: vi.fn(),
      wrap: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CacheService, { provide: CACHE_MANAGER, useValue: manager }],
    }).compile();

    service = moduleRef.get(CacheService);
  });

  it("get delegates to the cache manager", async () => {
    manager.get.mockResolvedValue({ id: 1 });

    await expect(service.get<{ id: number }>("user:1")).resolves.toEqual({
      id: 1,
    });
    expect(manager.get).toHaveBeenCalledWith("user:1");
  });

  it("set passes key, value and ttl through", async () => {
    manager.set.mockResolvedValue("value");

    await service.set("key", "value", 1_000);

    expect(manager.set).toHaveBeenCalledWith("key", "value", 1_000);
  });

  it("set without ttl leaves ttl undefined so the module default applies", async () => {
    await service.set("key", "value");

    expect(manager.set).toHaveBeenCalledWith("key", "value", undefined);
  });

  it("del delegates to the cache manager", async () => {
    manager.del.mockResolvedValue(true);

    await expect(service.del("key")).resolves.toBe(true);
    expect(manager.del).toHaveBeenCalledWith("key");
  });

  it("clear delegates to the cache manager", async () => {
    manager.clear.mockResolvedValue(true);

    await expect(service.clear()).resolves.toBe(true);
    expect(manager.clear).toHaveBeenCalledOnce();
  });

  it("wrap passes key, factory and ttl through", async () => {
    const factory = vi.fn(async () => "computed");
    manager.wrap.mockResolvedValue("computed");

    await expect(service.wrap("key", factory, 2_000)).resolves.toBe("computed");
    expect(manager.wrap).toHaveBeenCalledWith("key", factory, 2_000);
  });
});
