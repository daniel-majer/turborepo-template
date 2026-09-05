// Stable entry point for generated types and hooks.
// Zod schemas use @repo/api-client/schemas to avoid type/value name collisions.
export * from "./generated/api";
export * from "./generated/model";
export {
  ApiError,
  type ApiErrorBody,
  fetcher,
  NETWORK_ERROR_STATUS,
} from "./fetcher";
