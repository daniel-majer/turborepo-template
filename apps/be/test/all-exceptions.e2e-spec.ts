import { Controller, Get, NotFoundException } from "@nestjs/common";

import { useTestApp } from "./setup.js";

@Controller("boom")
class BoomController {
  @Get("http")
  httpError() {
    throw new NotFoundException("User not found");
  }

  @Get("unknown")
  unknownError() {
    throw new Error("db exploded: password=secret");
  }
}

describe("AllExceptionsFilter (e2e)", () => {
  const t = useTestApp({ controllers: [BoomController] });

  it("HttpException keeps its status and message", async () => {
    const res = await t.app.inject({ method: "GET", url: "/boom/http" });
    const body = res.json();

    expect(res.statusCode).toBe(404);
    expect(body.statusCode).toBe(404);
    expect(body.message).toBe("User not found");
    expect(body.path).toBe("/boom/http");
    expect(body.timestamp).toBeDefined();
  });

  it("unknown Error becomes a generic 500 without leaking details", async () => {
    const res = await t.app.inject({ method: "GET", url: "/boom/unknown" });
    const body = res.json();

    expect(res.statusCode).toBe(500);
    expect(body.message).toBe("Internal Server Error");
    expect(res.payload).not.toContain("db exploded");
    expect(res.payload).not.toContain("secret");
  });
});
