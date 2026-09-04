import { Controller, Get } from "@nestjs/common";

import { envelope } from "../src/common/transform-response.interceptor.js";
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
    return envelope([1, 2, 3], { pages: 10 });
  }

  // A row that happens to carry `data` and `meta` columns is a payload, not
  // an envelope: it has to end up nested inside one.
  @Get("lookalike")
  lookalike() {
    return { data: "column", meta: "column" };
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

  it("passes an envelope() response through unchanged", async () => {
    const res = await t.app.inject({ method: "GET", url: "/shapes/paginated" });

    expect(res.json()).toEqual({ data: [1, 2, 3], meta: { pages: 10 } });
  });

  it("wraps a value that only looks like an envelope", async () => {
    const res = await t.app.inject({ method: "GET", url: "/shapes/lookalike" });

    expect(res.json()).toEqual({
      data: { data: "column", meta: "column" },
    });
  });

  it("leaves the exception filter's envelope alone", async () => {
    const res = await t.app.inject({ method: "GET", url: "/does-not-exist" });
    const body = res.json();

    expect(res.statusCode).toBe(404);
    expect(body.data).toBeNull();
    expect(body.error.statusCode).toBe(404);
  });
});
