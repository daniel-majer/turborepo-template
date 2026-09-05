import { readFile } from "node:fs/promises";

import { Controller, Get } from "@nestjs/common";

import { ApiDataResponse } from "../src/common/api-data-response.decorator.js";
import { useTestApp } from "./setup.js";

const ERROR_REF = "#/components/schemas/ErrorEnvelopeDto";

@Controller("boom")
class BoomController {
  @Get()
  @ApiDataResponse({ type: "object" }, { nullable: true })
  boom() {
    throw new Error("unexpected");
  }
}

/** OpenAPI fields used by these assertions. */
interface Spec {
  openapi: string;
  paths: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        responses: Record<
          string,
          { content?: Record<string, { schema?: unknown }> }
        >;
      }
    >
  >;
  components: {
    schemas: Record<
      string,
      { required?: string[]; properties?: Record<string, unknown> }
    >;
  };
}

const operationsOf = (doc: Spec) =>
  Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.entries(item).map(([method, operation]) => ({
      name: `${method.toUpperCase()} ${path}`,
      operation,
    })),
  );

const properties = (schema: unknown): string[] =>
  typeof schema === "object" && schema !== null && "properties" in schema
    ? Object.keys(schema.properties ?? {})
    : [];

const schemaOf = (doc: Spec, path: string, method: string, status: string) =>
  doc.paths[path]?.[method]?.responses[status]?.content?.["application/json"]
    ?.schema;

describe("OpenAPI document (e2e)", () => {
  const t = useTestApp({ controllers: [BoomController] });

  const spec = async (): Promise<Spec> => {
    const res = await t.app.inject({ method: "GET", url: "/api/docs-json" });
    expect(res.statusCode).toBe(200);
    return res.json<Spec>();
  };

  it("is served for the client generator", async () => {
    const doc = await spec();

    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toContain("/api/users");
  });

  it("matches the committed openapi.json", async () => {
    const doc = await spec();
    const committed: Spec = JSON.parse(
      await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
    );

    // Compare the full contract, excluding the test-only route. Update with bun run api:sync.
    const paths = Object.fromEntries(
      Object.entries(doc.paths).filter(([path]) => path !== "/api/boom"),
    );

    expect({ ...doc, paths }).toEqual(committed);
  });

  it("derives validation constraints from DTO validators, including mapped types", async () => {
    const doc = await spec();
    const create = doc.components.schemas.CreateUserDto;
    const update = doc.components.schemas.UpdateUserDto;

    expect(create?.properties?.email).toMatchObject({
      type: "string",
      format: "email",
      maxLength: 255,
    });
    expect(create?.required).toContain("email");
    expect(update?.properties?.email).toEqual(create?.properties?.email);
    expect(update?.required ?? []).not.toContain("email");
  });

  describe("success responses", () => {
    it("documents a list as an array inside the data envelope", async () => {
      const doc = await spec();

      expect(schemaOf(doc, "/api/users", "get", "200")).toEqual({
        type: "object",
        required: ["data", "meta"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/UserDto" },
          },
          meta: { $ref: "#/components/schemas/UsersPageMetaDto" },
        },
      });
      expect(doc.components.schemas.UsersPageMetaDto).toMatchObject({
        required: ["nextCursor", "hasNextPage"],
        properties: {
          nextCursor: { type: "integer", nullable: true },
          hasNextPage: { type: "boolean" },
        },
      });
    });

    it("documents no meta on a route that never sends one", async () => {
      const doc = await spec();
      const schema = schemaOf(doc, "/api/users/{id}", "get", "200");

      // Metadata must be explicitly enabled with { meta: true }.
      expect(properties(schema)).toEqual(["data"]);
    });

    it("documents create as 201, not 200", async () => {
      const doc = await spec();

      expect(doc.paths["/api/users"]?.post?.responses["200"]).toBeUndefined();
      expect(schemaOf(doc, "/api/users", "post", "201")).toBeDefined();
    });

    it("matches the envelope the interceptor really sends", async () => {
      await t.app.inject({
        method: "POST",
        url: "/api/users",
        payload: { email: "ada@example.com" },
      });

      const res = await t.app.inject({ method: "GET", url: "/api/users" });

      expect(Object.keys(res.json())).toEqual(["data", "meta"]);
      expect(Array.isArray(res.json().data)).toBe(true);
    });
  });

  describe("error responses", () => {
    it("gives every operation a default error, decorated or not", async () => {
      const doc = await spec();
      const operations = operationsOf(doc);

      expect(operations.length).toBeGreaterThan(0);
      for (const { name, operation } of operations) {
        expect(
          operation.responses.default?.content?.["application/json"]?.schema,
          name,
        ).toEqual({ $ref: ERROR_REF });
      }
    });

    it("needs no per-status decorator on a route that can 404", async () => {
      const doc = await spec();
      const findOne = doc.paths["/api/users/{id}"]?.get;

      expect(Object.keys(findOne?.responses ?? {})).toEqual(["200", "default"]);
    });

    it("matches what AllExceptionsFilter really sends", async () => {
      const doc = await spec();
      const envelope = doc.components.schemas.ErrorEnvelopeDto ?? {};
      const error = doc.components.schemas.ApiErrorDto ?? {};

      const res = await t.app.inject({ method: "GET", url: "/api/users/999" });
      const body = res.json();

      expect(res.statusCode).toBe(404);
      // All required fields must be present.
      expect(Object.keys(body)).toEqual(
        expect.arrayContaining(envelope.required ?? []),
      );
      expect(Object.keys(body.error)).toEqual(
        expect.arrayContaining(error.required ?? []),
      );
      // All returned fields must be documented.
      expect(Object.keys(error.properties ?? {})).toEqual(
        expect.arrayContaining(Object.keys(body.error)),
      );
    });

    it("documents details, which only a validation failure carries", async () => {
      const doc = await spec();
      const error = doc.components.schemas.ApiErrorDto ?? {};

      const res = await t.app.inject({
        method: "POST",
        url: "/api/users",
        payload: { email: "not-an-email" },
      });

      expect(Array.isArray(res.json().error.details)).toBe(true);
      expect(error.required).not.toContain("details");
      expect(error.properties?.details).toMatchObject({
        type: "array",
        items: { type: "string" },
      });
    });

    it("keeps an unexpected 500 inside the same envelope", async () => {
      const doc = await spec();
      const error = doc.components.schemas.ApiErrorDto ?? {};

      const res = await t.app.inject({ method: "GET", url: "/api/boom" });
      const body = res.json();

      expect(res.statusCode).toBe(500);
      expect(body.data).toBeNull();
      expect(body.error.details).toBeUndefined();
      expect(Object.keys(error.properties ?? {})).toEqual(
        expect.arrayContaining(Object.keys(body.error)),
      );
    });

    it("documents delete as an empty 204", async () => {
      const doc = await spec();
      const created = await t.app.inject({
        method: "POST",
        url: "/api/users",
        payload: { email: "ada@example.com" },
      });

      const res = await t.app.inject({
        method: "DELETE",
        url: `/api/users/${created.json().data.id}`,
      });

      expect(res.statusCode).toBe(204);
      expect(res.payload).toBe("");
      expect(
        doc.paths["/api/users/{id}"]?.delete?.responses["204"]?.content,
      ).toBeUndefined();
    });
  });
});
