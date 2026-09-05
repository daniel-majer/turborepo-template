import { useTestApp } from "./setup.js";

describe("AppController (e2e)", () => {
  const t = useTestApp();

  it("/ (GET)", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: "Hello World!" });
  });

  it("sets helmet security headers like the real server", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});
