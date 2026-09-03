import { useTestApp } from "./setup.js";

describe("DatabaseService (integration)", () => {
  const t = useTestApp();

  it("writes and reads a user", async () => {
    await t.db.user.create({ data: { email: "ada@example.com" } });

    await expect(t.db.user.count()).resolves.toBe(1);
  });

  it("starts the next test with an empty database", async () => {
    await expect(t.db.user.count()).resolves.toBe(0);
  });
});
