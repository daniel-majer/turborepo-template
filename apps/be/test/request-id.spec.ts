import { Writable } from "node:stream";

import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Req,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { FastifyRequest } from "fastify";
import { LoggerModule } from "nestjs-pino";

import { configureApp } from "../src/app.setup.js";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";
import { appConfig } from "../src/config/index.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

@Controller("requests")
class RequestController {
  @Get()
  get(@Req() request: FastifyRequest) {
    return {
      id: request.id,
      rawId: "id" in request.raw ? request.raw.id : null,
    };
  }

  @Get("failure")
  fail() {
    new Logger(RequestController.name).warn("request-id-correlation");
    throw new NotFoundException("Not found");
  }
}

describe("request ID correlation", () => {
  let app: NestFastifyApplication;
  const lines: string[] = [];

  beforeAll(async () => {
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [RequestController],
      imports: [
        LoggerModule.forRoot({ pinoHttp: [{ level: "info" }, stream] }),
      ],
      providers: [
        {
          provide: appConfig.KEY,
          useValue: {
            isProduction: true,
            corsOrigins: ["http://localhost:3000"],
          },
        },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    lines.length = 0;
  });

  const records = (): { req?: { id?: string }; msg?: string }[] =>
    lines
      .join("")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

  it("shares a server-generated UUID across Fastify, Pino and response headers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/requests",
      headers: { "x-request-id": "untrusted-client-id" },
    });
    const id = res.headers["x-request-id"];
    expect(id).toMatch(UUID);
    expect(res.json()).toEqual({ id, rawId: id });
    expect(records().some((record) => record.req?.id === id)).toBe(true);
  });

  it("uses the same ID in error bodies, request-scoped logs and access logs", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/requests/failure",
      headers: { origin: "http://localhost:3000" },
    });
    const id = res.headers["x-request-id"];
    expect(res.statusCode).toBe(404);
    expect(id).toMatch(UUID);
    expect(res.json().error.requestId).toBe(id);
    expect(res.headers["access-control-expose-headers"]).toContain(
      "x-request-id",
    );
    const logs = records();
    expect(
      logs.find((record) => record.msg === "request-id-correlation")?.req?.id,
    ).toBe(id);
    expect(
      logs.find((record) => record.msg === "request completed")?.req?.id,
    ).toBe(id);
  });

  it("generates a different ID for each request", async () => {
    const first = await app.inject({ method: "GET", url: "/api/requests" });
    const second = await app.inject({ method: "GET", url: "/api/requests" });
    expect(first.headers["x-request-id"]).not.toBe(
      second.headers["x-request-id"],
    );
  });
});
