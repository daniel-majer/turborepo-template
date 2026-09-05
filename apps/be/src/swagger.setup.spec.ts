import { Controller, Get, HttpCode, Redirect, type Type } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ApiResponse } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";

import { ApiDataResponse } from "./common/api-data-response.decorator.js";
import { RawResponse } from "./common/raw-response.decorator.js";
import {
  envelope,
  TransformResponseInterceptor,
} from "./common/transform-response.interceptor.js";
import { buildOpenApiDocument } from "./swagger.setup.js";

const location = {
  Location: {
    description: "Redirect target",
    schema: { type: "string" as const },
  },
};

@Controller("responses")
class DocumentedController {
  @Get("redirect")
  @RawResponse()
  @Redirect("/responses/empty", 302)
  @ApiResponse({ status: 302, description: "Redirect", headers: location })
  redirect() {}

  @Get("empty")
  @HttpCode(204)
  @ApiResponse({ status: 204, description: "No content" })
  empty() {}

  @Get("not-modified")
  @RawResponse()
  @HttpCode(304)
  @ApiResponse({ status: 304, description: "Not modified" })
  notModified() {}

  @Get("metadata")
  @ApiDataResponse({ type: "integer" }, { isArray: true, meta: true })
  metadata() {
    return envelope([1], { total: 1 });
  }
}

@Controller("undocumented")
class UndocumentedController {
  @Get()
  get() {
    return { value: 1 };
  }
}

@Controller("schema-missing")
class MissingSchemaController {
  @Get()
  @ApiResponse({ status: 200, content: { "application/json": {} } })
  get() {
    return { value: 1 };
  }
}

@Controller("raw-missing")
class MissingRawController {
  @Get()
  @Redirect("/elsewhere", 302)
  @ApiResponse({ status: 302, headers: location })
  get() {}
}

@Controller("location-missing")
class MissingLocationController {
  @Get()
  @RawResponse()
  @Redirect("/elsewhere", 302)
  @ApiResponse({ status: 302 })
  get() {}
}

async function createApp(
  controller: Type<unknown>,
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [
      { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { logger: false },
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe("OpenAPI response coverage", () => {
  it("accepts documented raw redirects and bodyless responses", async () => {
    const app = await createApp(DocumentedController);
    try {
      const doc = buildOpenApiDocument(app);
      expect(
        doc.paths["/responses/redirect"]?.get?.responses["302"],
      ).toMatchObject({ headers: location });
      const redirect = await app.inject({
        method: "GET",
        url: "/responses/redirect",
      });
      expect(redirect.statusCode).toBe(302);
      expect(redirect.headers.location).toBe("/responses/empty");
      await Promise.all(
        (
          [
            ["/responses/empty", 204],
            ["/responses/not-modified", 304],
          ] as const
        ).map(async ([url, status]) => {
          const res = await app.inject({ method: "GET", url });
          expect(res.statusCode).toBe(status);
          expect(res.payload).toBe("");
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("preserves untyped opt-in metadata", async () => {
    const app = await createApp(DocumentedController);
    try {
      const doc = buildOpenApiDocument(app);
      expect(
        doc.paths["/responses/metadata"]?.get?.responses["200"],
      ).toMatchObject({
        content: {
          "application/json": {
            schema: {
              required: ["data"],
              properties: {
                meta: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      });
    } finally {
      await app.close();
    }
  });

  it.each([
    [UndocumentedController, "/undocumented"],
    [MissingSchemaController, "/schema-missing"],
    [MissingRawController, "/raw-missing"],
    [MissingLocationController, "/location-missing"],
  ] as const)(
    "rejects incomplete response documentation for %s",
    async (controller, path) => {
      const app = await createApp(controller);
      try {
        expect(() => buildOpenApiDocument(app)).toThrow(path);
      } finally {
        await app.close();
      }
    },
  );
});
