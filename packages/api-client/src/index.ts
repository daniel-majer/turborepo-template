// The package's only entry point. Generated code is re-exported rather than
// imported directly by the apps, so a change to orval's output layout is one
// edit here instead of one per call site.
//
// The zod schemas are the exception: they are reached through
// "@repo/api-client/schemas". Orval names a schema after the operation it came
// from, and re-exporting values and types from one module makes shared names
// ambiguous. The subpath keeps the indirection in the package's `exports`.
export * from "./generated/api";
export * from "./generated/model";
export {
  ApiError,
  type ApiErrorBody,
  fetcher,
  NETWORK_ERROR_STATUS,
} from "./fetcher";
