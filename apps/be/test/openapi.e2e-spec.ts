import { readFile } from "node:fs/promises";

import { Controller, Get } from "@nestjs/common";

import { useTestApp } from "./setup.js";

const ERROR_REF = "#/components/schemas/ErrorEnvelopeDto";

@Controller("boom")
class BoomController {
  @Get()
  boom() {
    throw new Error("unexpected");
  }
}

/** Just enough of the document to assert on; the full type fights the tests. */
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
    const res = await t.app.inject({ method: "GET", url: "/docs-json" });
    expect(res.statusCode).toBe(200);
    return res.json<Spec>();
  };

  it("is served for the client generator", async () => {
    const doc = await spec();

    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toContain("/users");
  });

  it("matches the committed openapi.json", async () => {
    const doc = await spec();
    const committed: Spec = JSON.parse(
      await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
    );

    // The whole document, not a sample of it: the generator reads this file,
    // so anything stale in it - a renamed property, a changed format, a new
    // query parameter - is a client built against an api that no longer
    // exists. Run `bun run api:sync`.
    const paths = Object.fromEntries(
      Object.entries(doc.paths).filter(([path]) => path !== "/boom"),
    );

    expect({ ...doc, paths }).toEqual(committed);
  });

  describe("success responses", () => {
    it("documents a list as an array inside the data envelope", async () => {
      const doc = await spec();

      expect(schemaOf(doc, "/users", "get", "200")).toEqual({
        type: "object",
        required: ["data"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/UserDto" },
          },
        },
      });
    });

    it("documents no meta on a route that never sends one", async () => {
      const doc = await spec();
      const schema = schemaOf(doc, "/users/{id}", "get", "200");

      // meta is opt-in (`@ApiDataResponse(Dto, { meta: true })`). Documenting
      // it everywhere would generate a model type per route that no handler
      // can ever produce.
      expect(properties(schema)).toEqual(["data"]);
    });

    it("documents create as 201, not 200", async () => {
      const doc = await spec();

      expect(doc.paths["/users"]?.post?.responses["200"]).toBeUndefined();
      expect(schemaOf(doc, "/users", "post", "201")).toBeDefined();
    });

    it("matches the envelope the interceptor really sends", async () => {
      await t.app.inject({
        method: "POST",
        url: "/users",
        payload: { email: "ada@example.com" },
      });

      const res = await t.app.inject({ method: "GET", url: "/users" });

      expect(Object.keys(res.json())).toEqual(["data"]);
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
      const findOne = doc.paths["/users/{id}"]?.get;

      expect(Object.keys(findOne?.responses ?? {})).toEqual(["200", "default"]);
    });

    it("matches what AllExceptionsFilter really sends", async () => {
      const doc = await spec();
      const envelope = doc.components.schemas.ErrorEnvelopeDto ?? {};
      const error = doc.components.schemas.ApiErrorDto ?? {};

      const res = await t.app.inject({ method: "GET", url: "/users/999" });
      const body = res.json();

      expect(res.statusCode).toBe(404);
      // Nothing documented as always-present is missing...
      expect(Object.keys(body)).toEqual(
        expect.arrayContaining(envelope.required ?? []),
      );
      expect(Object.keys(body.error)).toEqual(
        expect.arrayContaining(error.required ?? []),
      );
      // ...and nothing is sent that the spec does not mention.
      expect(Object.keys(error.properties ?? {})).toEqual(
        expect.arrayContaining(Object.keys(body.error)),
      );
    });

    it("documents details, which only a validation failure carries", async () => {
      const doc = await spec();
      const error = doc.components.schemas.ApiErrorDto ?? {};

      const res = await t.app.inject({
        method: "POST",
        url: "/users",
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

      const res = await t.app.inject({ method: "GET", url: "/boom" });
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
        url: "/users",
        payload: { email: "ada@example.com" },
      });

      const res = await t.app.inject({
        method: "DELETE",
        url: `/users/${created.json().data.id}`,
      });

      expect(res.statusCode).toBe(204);
      expect(res.payload).toBe("");
      expect(
        doc.paths["/users/{id}"]?.delete?.responses["204"]?.content,
      ).toBeUndefined();
    });
  });
});
