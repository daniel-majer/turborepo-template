import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  getSchemaPath,
  OpenAPIObject,
  SwaggerModule,
} from "@nestjs/swagger";

import { API_PREFIX } from "./api-prefix.js";
import { applyDataResponses } from "./common/api-data-response.decorator.js";
import { ErrorEnvelopeDto } from "./common/error-envelope.dto.js";
import { RAW_RESPONSE_EXTENSION } from "./common/raw-response.decorator.js";

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

/** Serve Swagger below the application prefix. */
export function setupSwagger(app: INestApplication) {
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app), {
    jsonDocumentUrl: `${API_PREFIX}/docs-json`,
  });
}

/** Prefix operation IDs with the controller to avoid generated-client name collisions. */
function operationIdFactory(controllerKey: string, methodKey: string): string {
  const controller = controllerKey.replace(/Controller$/, "");
  const prefix = controller.charAt(0).toLowerCase() + controller.slice(1);

  return `${prefix}${methodKey.charAt(0).toUpperCase()}${methodKey.slice(1)}`;
}

// Responses that have no body by definition.
const EMPTY_BODY_STATUSES = new Set(["204", "205", "304"]);

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
      /^[23]/.test(status),
    );
    const complete =
      success.length > 0 &&
      success.every(
        ([status, response]) =>
          EMPTY_BODY_STATUSES.has(status) ||
          (status.startsWith("2") && describesContent(response)) ||
          (status.startsWith("3") &&
            operation[RAW_RESPONSE_EXTENSION] === true &&
            describesLocation(response)),
      );

    if (!complete) {
      undescribed.push(label);
    }
  }

  if (undescribed.length > 0) {
    throw new Error(
      `These routes describe no response payload: ${undescribed.join(", ")}. ` +
        "Use @ApiDataResponse, or document raw redirects and bodyless responses explicitly.",
    );
  }

  return document;
}

function describesContent(response: unknown): boolean {
  if (!isObject(response)) return false;
  if ("$ref" in response) return true;
  const content = response.content;
  if (!isObject(content)) return false;
  const mediaTypes = Object.values(content);
  return (
    mediaTypes.length > 0 &&
    mediaTypes.every((media) => isObject(media) && isObject(media.schema))
  );
}

function describesLocation(response: unknown): boolean {
  if (!isObject(response) || !isObject(response.headers)) return false;
  return Object.entries(response.headers).some(
    ([name, header]) =>
      name.toLowerCase() === "location" &&
      isObject(header) &&
      ("$ref" in header || isObject(header.schema)),
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
