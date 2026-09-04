import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  getSchemaPath,
  OpenAPIObject,
  SwaggerModule,
} from "@nestjs/swagger";

import { ErrorEnvelopeDto } from "./common/error-envelope.dto.js";

/**
 * One definition of the document, used by two callers: scripts/generate-openapi.ts
 * writes it to openapi.json for the client generator, and configureApp() serves
 * it at /docs outside production. A spec built differently from the one that is
 * served is a spec nobody can trust.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("API")
    .setDescription(
      "Every response is an envelope: `{ data }`, or `{ data: null, error }`.",
    )
    .setVersion("0.1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // Referenced by $ref from the default response below, so it has to be
    // registered even though no route declares it as a type.
    extraModels: [ErrorEnvelopeDto],
    operationIdFactory,
  });

  return withDefaultErrorResponse(document);
}

/** Serves Swagger UI at /docs and the raw spec at /docs-json. */
export function setupSwagger(app: INestApplication) {
  SwaggerModule.setup("docs", app, buildOpenApiDocument(app), {
    jsonDocumentUrl: "docs-json",
  });
}

/**
 * The operationId is what a generator names its output after, so it has to be
 * unique across the whole api: `findAll` alone would collide the moment a
 * second controller has one. UsersController.findAll becomes `usersFindAll`,
 * and the generated hook `useUsersFindAll`.
 */
function operationIdFactory(controllerKey: string, methodKey: string): string {
  const controller = controllerKey.replace(/Controller$/, "");
  const prefix = controller.charAt(0).toLowerCase() + controller.slice(1);

  return `${prefix}${methodKey.charAt(0).toUpperCase()}${methodKey.slice(1)}`;
}

/**
 * Every route can fail and every failure goes through AllExceptionsFilter, so
 * the error envelope belongs on every operation. `default` covers any status
 * the route does not list, which is why no handler needs an error decorator.
 */
function withDefaultErrorResponse(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(document.paths)) {
    // A path item also holds non-operation keys such as `parameters` and `$ref`.
    for (const operation of Object.values(pathItem)) {
      if (
        typeof operation !== "object" ||
        operation === null ||
        Array.isArray(operation) ||
        !("responses" in operation)
      ) {
        continue;
      }

      operation.responses.default ??= errorResponse();
    }
  }

  return document;
}

/**
 * A fresh object per operation. One shared reference would mean a later
 * per-route tweak silently rewrites every other route's default response.
 */
function errorResponse() {
  return {
    description:
      "Any failure. `data` is null and `error` says what went wrong.",
    content: {
      "application/json": {
        schema: { $ref: getSchemaPath(ErrorEnvelopeDto) },
      },
    },
  };
}
