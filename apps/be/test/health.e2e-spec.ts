import { useTestApp } from "./setup.js";

describe("Health (e2e)", () => {
  const t = useTestApp();

  it("reports liveness without touching a dependency", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/health/live" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { status: "ok" } });
  });

  it("reports readiness with the state of each dependency", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/health/ready" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      data: { status: "ok", checks: { database: "up", cache: "up" } },
    });
  });
});
