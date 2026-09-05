import { applyDecorators, SetMetadata } from "@nestjs/common";
import { ApiExtension } from "@nestjs/swagger";

export const RAW_RESPONSE = "rawResponse";
export const RAW_RESPONSE_EXTENSION = "x-raw-response";

/**
 * Skip envelopes for streams, SSE and redirects.
 * Document these routes with @ApiResponse, not @ApiDataResponse.
 */
export const RawResponse = () =>
  applyDecorators(
    SetMetadata(RAW_RESPONSE, true),
    ApiExtension(RAW_RESPONSE_EXTENSION, true),
  );
