/** Shared transport for generated calls. TODO(template): add auth headers here. */

/** No HTTP response: network failure, CORS or cancellation. */
export const NETWORK_ERROR_STATUS = 0;

/** Backend error envelope body. */
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  /** Validation failures. */
  details?: string[];
  timestamp: string;
  path: string;
  /** Absent when no server response was received. */
  requestId?: string;
}

/** HTTP and network error, compatible with generated error-envelope types. */
export class ApiError extends Error {
  readonly data = null;
  readonly error: ApiErrorBody;
  /** Retry-After delay in milliseconds. */
  readonly retryAfterMs: number | undefined;

  constructor(
    readonly status: number,
    body: ApiErrorBody,
    options?: { cause?: unknown; retryAfterMs?: number },
  ) {
    super(body.message, { cause: options?.cause });
    this.name = "ApiError";
    this.error = body;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

// Distinguish invalid JSON from an absent body.
const NOT_JSON = Symbol("not json");

export async function fetcher<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await request(url, options);

  // Use null for empty bodies; React Query rejects undefined results.
  const empty =
    response.status === 204 || response.headers.get("content-length") === "0";
  const payload: unknown = empty
    ? null
    : await response.json().catch(() => NOT_JSON);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorBodyOf(payload, response.status, url, response),
      { retryAfterMs: retryAfterOf(response) },
    );
  }

  // Reject unexpected 2xx responses, such as a proxy login page.
  if (!empty && !isEnvelope(payload)) {
    throw new ApiError(
      response.status,
      fallbackBody(
        response.status,
        `The api answered ${response.status} with something other than a ` +
          "response envelope - is the base url pointing at the api?",
        url,
        response.headers.get("x-request-id"),
      ),
    );
  }

  // T comes from the spec; response payloads are not runtime-validated.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return payload as T;
}

function isEnvelope(payload: unknown): payload is { data: unknown } {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

// Retry-After is seconds or an http date; unparseable counts as absent.
function retryAfterOf(response: Response): number | undefined {
  const header = response.headers.get("retry-after");

  if (header === null || header.trim() === "") {
    return undefined;
  }

  const seconds = Number(header);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const at = Date.parse(header);

  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

async function request(url: string, options: RequestInit): Promise<Response> {
  // Keep configuration errors separate from network errors.
  const target = resolveUrl(url);

  try {
    return await fetch(target, {
      // Include cookies for API sessions.
      credentials: "include",
      ...options,
    });
  } catch (cause) {
    // Normalize network failures to the same error shape as HTTP failures.
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      fallbackBody(NETWORK_ERROR_STATUS, "Could not reach the api", url),
      { cause },
    );
  }
}

/** Require explicit HTTP(S) bases, optionally including a reverse-proxy path. */
export function validateApiBaseUrl(
  value: string | undefined,
  variable: string,
): string {
  let parsed: URL;

  try {
    parsed = new URL(value ?? "");
  } catch {
    throw new Error(`${variable} must be an absolute HTTP(S) API URL`);
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `${variable} must be an HTTP(S) API URL without credentials, query or fragment`,
    );
  }

  return parsed.href.replace(/\/+$/, "");
}

/** Server requests may override the build-time browser API address. */
function resolveUrl(url: string): string {
  const isServer = typeof window === "undefined";
  const publicBase = validateApiBaseUrl(
    process.env.NEXT_PUBLIC_API_URL,
    "NEXT_PUBLIC_API_URL",
  );
  const base =
    isServer && process.env.API_URL
      ? validateApiBaseUrl(process.env.API_URL, "API_URL")
      : publicBase;

  return join(base, url);
}

// Preserve base paths and avoid double slashes.
function join(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function errorBodyOf(
  payload: unknown,
  status: number,
  url: string,
  response: Response,
): ApiErrorBody {
  // Proxy errors may lack an envelope; preserve their HTTP status.
  const requestId = response.headers.get("x-request-id");
  return isErrorEnvelope(payload)
    ? {
        ...payload.error,
        ...(requestId ? { requestId } : {}),
      }
    : fallbackBody(
        status,
        `Request failed with status ${status}`,
        url,
        requestId,
      );
}

/** Fallback for errors without a backend envelope. */
function fallbackBody(
  statusCode: number,
  message: string,
  path: string,
  requestId?: string | null,
): ApiErrorBody {
  return {
    statusCode,
    message,
    timestamp: new Date().toISOString(),
    path,
    ...(requestId ? { requestId } : {}),
  };
}

function isErrorEnvelope(payload: unknown): payload is { error: ApiErrorBody } {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("error" in payload)
  ) {
    return false;
  }

  const { error } = payload;

  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    "timestamp" in error &&
    typeof error.timestamp === "string" &&
    "path" in error &&
    typeof error.path === "string" &&
    "message" in error &&
    typeof error.message === "string" &&
    (!("requestId" in error) || typeof error.requestId === "string") &&
    (!("details" in error) ||
      (Array.isArray(error.details) &&
        error.details.every((detail) => typeof detail === "string")))
  );
}
