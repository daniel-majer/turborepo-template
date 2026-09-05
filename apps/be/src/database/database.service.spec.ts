import { DatabaseService } from "./database.service.js";

function setup() {
  const db = new DatabaseService({
    url: "postgresql://unused@localhost/unused",
  });
  const connect = vi.spyOn(db, "$connect").mockResolvedValue();
  const query = vi.spyOn(db, "$queryRaw").mockResolvedValue([{ result: 1 }]);
  const disconnect = vi.spyOn(db, "$disconnect").mockResolvedValue();
  return { db, connect, query, disconnect };
}

describe("DatabaseService lifecycle", () => {
  it("proves the database answers before completing startup", async () => {
    const { db, connect, query } = setup();
    await db.onModuleInit();
    expect(connect).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(["SELECT 1"]);
  });

  it("rejects startup when the lazy pool cannot reach the database", async () => {
    const { db, query } = setup();
    query.mockRejectedValue(new Error("database unavailable"));
    await expect(db.onModuleInit()).rejects.toThrow("database unavailable");
  });

  it("disconnects during shutdown", async () => {
    const { db, disconnect } = setup();
    await db.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
