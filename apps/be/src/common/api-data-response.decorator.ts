import {
  applyDecorators,
  HttpStatus,
  RequestMethod,
  type Type,
} from "@nestjs/common";
import { HTTP_CODE_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";

/** Local schema type: Swagger does not export SchemaObject through a public path. */
type RawSchema = { type: string; format?: string; example?: unknown };

type Content = Type<unknown> | RawSchema;

interface ApiDataResponseOptions {
  /** Wrap the model as a list. */
  isArray?: boolean;
  /** Override @HttpCode or the default status (POST: 201, otherwise 200). */
  status?: HttpStatus | number;
  /** Allow data: null, including handlers that return undefined. */
  nullable?: boolean;
  /** Include metadata returned with envelope(data, meta). */
  meta?: boolean | Type<unknown>;
}

interface Pending {
  target: object;
  propertyKey: string | symbol | undefined;
  descriptor: PropertyDescriptor | undefined;
  payload: object;
  options: ApiDataResponseOptions;
}

// Apply responses after all controller decorators have run.
const pending: Pending[] = [];
let applied = 0;

/**
 * Document the model inside a { data, meta? } envelope.
 * Defer registration so @HttpCode and route metadata are available.
 */
export function ApiDataResponse(
  content: Content,
  options: ApiDataResponseOptions = {},
) {
  const isModel = typeof content === "function";
  const metaModel =
    typeof options.meta === "function" ? options.meta : undefined;
  const item = isModel ? { $ref: getSchemaPath(content) } : content;
  const payload = options.isArray
    ? { type: "array" as const, items: item }
    : item;

  return applyDecorators(
    // Register models referenced only by this custom schema.
    ...(isModel ? [ApiExtraModels(content)] : []),
    ...(metaModel ? [ApiExtraModels(metaModel)] : []),
    (
      target: object,
      propertyKey?: string | symbol,
      descriptor?: PropertyDescriptor,
    ) => {
      pending.push({ target, propertyKey, descriptor, payload, options });
    },
  );
}

/** Applies every recorded response as an @ApiResponse. Idempotent. */
export function applyDataResponses(): void {
  for (const entry of pending.slice(applied)) {
    const { target, propertyKey, descriptor, payload, options } = entry;
    const decorate = ApiResponse({
      status: options.status ?? successStatusOf(descriptor?.value),
      schema: {
        type: "object",
        required:
          typeof options.meta === "function" ? ["data", "meta"] : ["data"],
        properties: {
          data: options.nullable ? asNullable(payload) : payload,
          ...(options.meta
            ? {
                meta:
                  typeof options.meta === "function"
                    ? { $ref: getSchemaPath(options.meta) }
                    : { type: "object", additionalProperties: true },
              }
            : {}),
        },
      },
    });

    if (propertyKey === undefined || descriptor === undefined) {
      // Class-level use: Nest passes only the constructor.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      decorate(target as Type<unknown>);
    } else {
      decorate(target, propertyKey, descriptor);
    }
  }

  applied = pending.length;
}

// Match Swagger defaults: @HttpCode, otherwise POST 201 or 200.
function successStatusOf(handler: unknown): number {
  if (typeof handler !== "function") {
    return HttpStatus.OK;
  }

  const httpCode: unknown = Reflect.getMetadata(HTTP_CODE_METADATA, handler);

  if (typeof httpCode === "number") {
    return httpCode;
  }

  return Reflect.getMetadata(METHOD_METADATA, handler) === RequestMethod.POST
    ? HttpStatus.CREATED
    : HttpStatus.OK;
}

// OpenAPI 3.0 requires allOf to make a $ref nullable.
function asNullable<T extends object>(payload: T) {
  return "$ref" in payload
    ? { allOf: [payload], nullable: true }
    : { ...payload, nullable: true };
}
