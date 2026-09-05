import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  getSchemaPath,
  OpenAPIObject,
  SwaggerModule,
} from "@nestjs/swagger";

import { applyDataResponses } from "./common/api-data-response.decorator.js";
import { ErrorEnvelopeDto } from "./common/error-envelope.dto.js";

/** Build the same contract for Swagger UI and the committed OpenAPI spec. */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  // Must run before the explorer reads the metadata.
  applyDataResponses();

  const config = new DocumentBuilder()
    .setTitle("API")
    .setDescription(
      "Every response is an envelope: `{ data }`, or `{ data: null, error }`.",
    )
    .setVersion("0.1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // Register the model referenced by each default error response.
    extraModels: [ErrorEnvelopeDto],
    operationIdFactory,
  });

  return assertEveryOperationDescribesItsPayload(
    withDefaultErrorResponse(document),
  );
}

/** Serves Swagger UI at /docs and the raw spec at /docs-json. */
export function setupSwagger(app: INestApplication) {
  SwaggerModule.setup("docs", app, buildOpenApiDocument(app), {
    jsonDocumentUrl: "docs-json",
  });
}

/** Prefix operation IDs with the controller to avoid generated-client name collisions. */
function operationIdFactory(controllerKey: string, methodKey: string): string {
  const controller = controllerKey.replace(/Controller$/, "");
  const prefix = controller.charAt(0).toLowerCase() + controller.slice(1);

  return `${prefix}${methodKey.charAt(0).toUpperCase()}${methodKey.slice(1)}`;
}

// Responses that have no body by definition.
const EMPTY_BODY_STATUSES = new Set(["204", "205"]);

/** Document the shared error envelope for every operation. */
function withDefaultErrorResponse(document: OpenAPIObject): OpenAPIObject {
  for (const { operation } of operationsOf(document)) {
    operation.responses.default ??= errorResponse();
  }

  return document;
}

/** Fail generation if a success payload lacks a schema; otherwise hooks become untyped. */
function assertEveryOperationDescribesItsPayload(
  document: OpenAPIObject,
): OpenAPIObject {
  const undescribed: string[] = [];

  for (const { label, operation } of operationsOf(document)) {
    const success = Object.entries(operation.responses).filter(([status]) =>
      status.startsWith("2"),
    );
    const complete =
      success.length > 0 &&
      success.every(
        ([status, response]) =>
          EMPTY_BODY_STATUSES.has(status) || describesContent(response),
      );

    if (!complete) {
      undescribed.push(label);
    }
  }

  if (undescribed.length > 0) {
    throw new Error(
      `These routes describe no response payload: ${undescribed.join(", ")}. ` +
        "Every handler needs @ApiDataResponse with the shape it returns.",
    );
  }

  return document;
}

function describesContent(response: unknown): boolean {
  return (
    typeof response === "object" && response !== null && "content" in response
  );
}

// Skip non-operation keys such as parameters and $ref.
function* operationsOf(document: OpenAPIObject) {
  for (const [route, pathItem] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (
        typeof operation !== "object" ||
        operation === null ||
        Array.isArray(operation) ||
        !("responses" in operation)
      ) {
        continue;
      }

      yield { label: `${method.toUpperCase()} ${route}`, operation };
    }
  }
}

/** Keep response objects independent so route-specific changes stay local. */
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
