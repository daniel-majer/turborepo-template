import { SetMetadata } from "@nestjs/common";

export const RAW_RESPONSE = "rawResponse";

/**
 * Skip envelopes for streams, SSE and redirects.
 * Document these routes with @ApiResponse, not @ApiDataResponse.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);
