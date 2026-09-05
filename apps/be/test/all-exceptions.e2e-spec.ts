import { Controller, Get, NotFoundException } from "@nestjs/common";

import { ApiDataResponse } from "../src/common/api-data-response.decorator.js";
import { useTestApp } from "./setup.js";

@Controller("boom")
class BoomController {
  @Get("http")
  @ApiDataResponse({ type: "object" }, { nullable: true })
  httpError() {
    throw new NotFoundException("User not found");
  }

  @Get("unknown")
  @ApiDataResponse({ type: "object" }, { nullable: true })
  unknownError() {
    throw new Error("db exploded: password=secret");
  }
}

describe("AllExceptionsFilter (e2e)", () => {
  const t = useTestApp({ controllers: [BoomController] });

  it("HttpException keeps its status and message", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/boom/http" });
    const body = res.json();

    expect(res.statusCode).toBe(404);
    expect(body.error.statusCode).toBe(404);
    expect(body.error.message).toBe("User not found");
    expect(body.error.path).toBe("/api/boom/http");
    expect(body.error.timestamp).toBeDefined();
  });

  it("envelopes the failure so data is never missing", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/boom/http" });

    expect(Object.keys(res.json()).toSorted()).toEqual(["data", "error"]);
    expect(res.json().data).toBeNull();
  });

  it("unknown Error becomes a generic 500 without leaking details", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/boom/unknown" });
    const body = res.json();

    expect(res.statusCode).toBe(500);
    expect(body.error.message).toBe("Internal Server Error");
    expect(body.error.details).toBeUndefined();
    expect(res.payload).not.toContain("db exploded");
    expect(res.payload).not.toContain("secret");
  });

  it("collects validation failures into details", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/users",
      payload: { email: "not-an-email" },
    });
    const body = res.json();

    expect(res.statusCode).toBe(400);
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toEqual(["email must be an email"]);
  });
});
