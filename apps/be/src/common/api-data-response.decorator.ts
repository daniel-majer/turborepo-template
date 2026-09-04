import { applyDecorators, HttpStatus, Type } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";

/**
 * A DTO class, or - for a response that is not an object - a schema fragment.
 * Written out here rather than imported: @nestjs/swagger keeps SchemaObject
 * behind a deep path its package exports do not expose.
 */
type RawSchema = { type: string; format?: string; example?: unknown };

type Content = Type<unknown> | RawSchema;

interface ApiDataResponseOptions {
  /** The handler returns a list of the model. */
  isArray?: boolean;
  /** Defaults to 200; pass 201 on @Post routes. */
  status?: HttpStatus | number;
  /**
   * The route answers with `envelope(data, meta)`. Off by default: a `meta`
   * documented on every response is a promise no handler here keeps, and the
   * client generator turns each one into a model type nothing can receive.
   */
  meta?: boolean;
}

/**
 * Documents a success response the way TransformResponseInterceptor actually
 * sends it - the model wrapped in a `data` envelope - instead of the bare
 * model the handler returns.
 *
 *   @ApiDataResponse(UserDto)                     // { data: { ... } }
 *   @ApiDataResponse(UserDto, { isArray: true })  // { data: [ ... ] }
 *   @ApiDataResponse({ type: "string" })          // { data: "hello" }
 *   @ApiDataResponse(UserDto, { meta: true })     // { data, meta } - see envelope()
 */
export function ApiDataResponse(
  content: Content,
  options: ApiDataResponseOptions = {},
) {
  const { isArray = false, status = HttpStatus.OK, meta = false } = options;

  const isModel = typeof content === "function";
  const item = isModel ? { $ref: getSchemaPath(content) } : content;
  const payload = isArray ? { type: "array" as const, items: item } : item;

  return applyDecorators(
    // A model that appears only inside this hand-written schema is invisible
    // to the scanner, so it has to be registered explicitly.
    ...(isModel ? [ApiExtraModels(content)] : []),
    ApiResponse({
      status,
      schema: {
        type: "object",
        required: ["data"],
        properties: {
          data: payload,
          // Untyped on purpose: meta carries pagination or whatever a route
          // needs, and pinning a shape here would be wrong for the next one.
          ...(meta
            ? { meta: { type: "object", additionalProperties: true } }
            : {}),
        },
      },
    }),
  );
}
