import { Controller, Get } from "@nestjs/common";

import { useTestApp } from "./setup.js";

@Controller("shapes")
class ShapesController {
  @Get("object")
  object() {
    return { id: 1, name: "Anna" };
  }

  @Get("nothing")
  nothing() {
    return undefined;
  }

  @Get("false")
  falsy() {
    return false;
  }

  @Get("paginated")
  paginated() {
    return { data: [1, 2, 3], meta: { pages: 10 } };
  }
}

describe("TransformResponseInterceptor (e2e)", () => {
  const t = useTestApp({ controllers: [ShapesController] });

  it("wraps a plain value in a data envelope", async () => {
    const res = await t.app.inject({ method: "GET", url: "/shapes/object" });

    expect(res.json()).toEqual({ data: { id: 1, name: "Anna" } });
  });

  it("returns data: null when the handler returns nothing", async () => {
    const res = await t.app.inject({ method: "GET", url: "/shapes/nothing" });

    expect(res.json()).toEqual({ data: null });
  });

  it("preserves falsy values instead of swallowing them", async () => {
    const res = await t.app.inject({ method: "GET", url: "/shapes/false" });

    expect(res.json()).toEqual({ data: false });
  });

  it("passes { data, meta } responses through unchanged", async () => {
    const res = await t.app.inject({ method: "GET", url: "/shapes/paginated" });

    expect(res.json()).toEqual({ data: [1, 2, 3], meta: { pages: 10 } });
  });

  it("does not wrap error responses from the exception filter", async () => {
    const res = await t.app.inject({ method: "GET", url: "/does-not-exist" });
    const body = res.json();

    expect(res.statusCode).toBe(404);
    expect(body.data).toBeUndefined();
    expect(body.statusCode).toBe(404);
  });
});
