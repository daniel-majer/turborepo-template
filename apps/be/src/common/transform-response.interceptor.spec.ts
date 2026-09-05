import { createMock } from "@golevelup/ts-vitest";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, of } from "rxjs";

import { RawResponse } from "./raw-response.decorator.js";
import {
  envelope,
  TransformResponseInterceptor,
} from "./transform-response.interceptor.js";

// Exercise the interceptor without booting Nest.
async function intercept(
  handlerResult: unknown,
  handler: () => unknown = () => undefined,
) {
  const interceptor = new TransformResponseInterceptor(new Reflector());
  const context = createMock<ExecutionContext>();
  context.getHandler.mockReturnValue(handler);
  const next = createMock<CallHandler>({ handle: () => of(handlerResult) });

  return await firstValueFrom(interceptor.intercept(context, next));
}

// Nest stores route metadata on the handler function.
const rawHandler = () => "raw bytes";
RawResponse()(rawHandler);

describe("TransformResponseInterceptor", () => {
  it("wraps a plain value", async () => {
    expect(await intercept("hello")).toEqual({ data: "hello" });
  });

  it("turns an empty response into an explicit null, not a missing key", async () => {
    expect(await intercept(undefined)).toEqual({ data: null });
    expect(await intercept(null)).toEqual({ data: null });
  });

  it("passes an envelope() result through with its metadata", async () => {
    const result = await intercept(envelope([1, 2], { total: 2 }));

    expect(result).toEqual({ data: [1, 2], meta: { total: 2 } });
  });

  it("passes an envelope() result without metadata through unnested", async () => {
    expect(await intercept(envelope([1, 2]))).toEqual({ data: [1, 2] });
  });

  it("wraps a domain object that happens to carry data and meta fields", async () => {
    const row = { data: { size: 1 }, meta: { source: "webhook" } };

    expect(await intercept(row)).toEqual({ data: row });
  });

  it("does not leak the marker into the response body", async () => {
    const result = await intercept(envelope("x"));

    expect(JSON.stringify(result)).toBe('{"data":"x"}');
  });

  it("still recognises an envelope that came back through a cache", async () => {
    // Simulate CacheInterceptor's JSON round trip.
    const roundTripped: unknown = JSON.parse(
      JSON.stringify(envelope([1, 2], { total: 2 })),
    );

    expect(await intercept(roundTripped)).toEqual({
      data: [1, 2],
      meta: { total: 2 },
    });
  });

  it("leaves a @RawResponse() handler's return value alone", async () => {
    expect(await intercept("raw bytes", rawHandler)).toBe("raw bytes");
  });

  it("keeps the data key when the payload is undefined", async () => {
    // Ensure JSON retains data when the payload is undefined.
    const result = await intercept(envelope(undefined, { total: 0 }));

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      data: null,
      meta: { total: 0 },
    });
  });
});
