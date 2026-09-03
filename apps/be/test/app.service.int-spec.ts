import { AppService } from "../src/app.service.js";
import { useTestApp } from "./setup.js";

describe("AppService (integration)", () => {
  const t = useTestApp();

  it("stores the hello message in Redis on the first call", async () => {
    const service = t.app.get(AppService);

    await expect(service.getHello()).resolves.toBe("Hello World!");
    await expect(t.cache.get("hello")).resolves.toBe("Hello World!");
  });

  it("serves a pre-cached message instead of rebuilding it", async () => {
    await t.cache.set("hello", "from redis", 5_000);

    await expect(t.app.get(AppService).getHello()).resolves.toBe("from redis");
  });
});
