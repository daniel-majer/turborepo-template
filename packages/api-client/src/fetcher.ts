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
  const payload: unknown =
    response.status === 204 || response.headers.get("content-length") === "0"
      ? null
      : await response.json().catch(() => NOT_JSON);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorBodyOf(payload, response.status, url),
      { retryAfterMs: retryAfterOf(response) },
    );
  }

  // Reject unexpected 2xx responses, such as a proxy login page.
  if (payload !== null && !isEnvelope(payload)) {
    throw new ApiError(
      response.status,
      fallbackBody(
        response.status,
        `The api answered ${response.status} with something other than a ` +
          "response envelope - is the base url pointing at the api?",
        url,
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

  if (header === null) {
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

/**
 * Use runtime API_URL on the server, build-time NEXT_PUBLIC_API_URL in the browser.
 * Server requests require an absolute base URL.
 */
function resolveUrl(url: string): string {
  const isServer = typeof window === "undefined";
  // `||`, not `??`: an unset compose variable or docker ARG arrives as "".
  const base =
    (isServer ? process.env.API_URL : undefined) ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";

  if (isServer && base === "") {
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      fallbackBody(
        NETWORK_ERROR_STATUS,
        `Cannot request "${url}" from the server without an absolute base url. ` +
          "Set API_URL to where the api answers from inside the network (in " +
          "docker compose that is the service name, http://api:3001), or make " +
          "this call from a client component.",
        url,
      ),
    );
  }

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
): ApiErrorBody {
  // Proxy errors may lack an envelope; preserve their HTTP status.
  return isErrorEnvelope(payload)
    ? payload.error
    : fallbackBody(status, `Request failed with status ${status}`, url);
}

/** Fallback for errors without a backend envelope. */
function fallbackBody(
  statusCode: number,
  message: string,
  path: string,
): ApiErrorBody {
  return { statusCode, message, timestamp: new Date().toISOString(), path };
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
    "message" in error &&
    typeof error.message === "string"
  );
}
