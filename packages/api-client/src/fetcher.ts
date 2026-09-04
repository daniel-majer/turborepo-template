/**
 * The single place every generated call goes through (orval's `mutator`). It
 * owns the base url, credentials and error handling, so no generated file has
 * to - and none of that has to be repeated at a call site either.
 *
 * TODO(template): authentication. When the api gets it, the header belongs here.
 */

/** Nothing answered at all: dns, connection refused, CORS, an aborted request. */
export const NETWORK_ERROR_STATUS = 0;

/** The `error` half of the envelope, as the backend's AllExceptionsFilter sends it. */
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  /** One entry per failed constraint, on a validation error. */
  details?: string[];
  timestamp: string;
  path: string;
}

/**
 * Thrown for every request that does not come back 2xx, including the ones
 * that never reached the server. react-query surfaces it as `error` and a
 * server component gets it as a rejected promise - either way the caller sees
 * the backend's own message rather than "Unexpected token < in JSON", and
 * never a bare TypeError whose shape nothing declared.
 *
 * The `data` and `error` fields mirror the error envelope on purpose: the
 * generated hooks type their TError from the spec, so what is thrown has to be
 * assignable to it. Extending Error on top of that keeps a stack trace and
 * `instanceof` working.
 */
export class ApiError extends Error {
  readonly data = null;
  readonly error: ApiErrorBody;

  constructor(
    readonly status: number,
    body: ApiErrorBody,
    options?: { cause?: unknown },
  ) {
    super(body.message, options);
    this.name = "ApiError";
    this.error = body;
  }
}

export async function fetcher<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await request(url, options);

  // 204 and friends have no body to parse, and response.json() would throw on
  // the empty string. null rather than undefined: react-query v5 rejects an
  // undefined query result.
  const payload: unknown =
    response.status === 204 || response.headers.get("content-length") === "0"
      ? null
      : await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorBodyOf(payload, response.status, url),
    );
  }

  // The generated caller declares T from the spec; nothing at run time can
  // check a json body against it, and pretending otherwise is what the zod
  // schemas are for.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return payload as T;
}

async function request(url: string, options: RequestInit): Promise<Response> {
  // Outside the try on purpose: resolveUrl throws its own, actionable error,
  // and catching it below would replace "set API_URL" with a generic
  // "could not reach the api".
  const target = resolveUrl(url);

  try {
    return await fetch(target, {
      // Cookies are how a session travels; without this a same-site login is
      // invisible to the api.
      credentials: "include",
      ...options,
    });
  } catch (cause) {
    // fetch rejects with a bare TypeError when the request never completed.
    // Left alone that reaches the ui as an error of a shape nothing declared,
    // and a component reading the envelope's fields throws while rendering the
    // very message it meant to show.
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      fallbackBody(NETWORK_ERROR_STATUS, "Could not reach the api", url),
      { cause },
    );
  }
}

/**
 * A browser request may be relative - one proxy serves the page and the api
 * under one origin - but on the server there is no origin to be relative to,
 * and fetch refuses to parse the url. Hence two variables: NEXT_PUBLIC_API_URL
 * is compiled into the browser bundle and holds the public address, API_URL is
 * read at run time and says how this process reaches the api from inside the
 * network, which in docker is a service name rather than a public host.
 */
function resolveUrl(url: string): string {
  const isServer = typeof window === "undefined";
  const base =
    (isServer ? process.env.API_URL : undefined) ??
    process.env.NEXT_PUBLIC_API_URL ??
    "";

  if (isServer && base === "") {
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      fallbackBody(
        NETWORK_ERROR_STATUS,
        `Cannot request "${url}" from the server without an absolute base url. ` +
          "Set API_URL to where the api answers from inside the network (in " +
          "docker compose that is the service name, http://be:3001), or make " +
          "this call from a client component.",
        url,
      ),
    );
  }

  return `${base}${url}`;
}

function errorBodyOf(
  payload: unknown,
  status: number,
  url: string,
): ApiErrorBody {
  // The envelope is what the api promises, but a proxy, a gateway or a crash
  // before the filter can put anything at all on the wire, and a client that
  // throws while building an error is the worst possible time to lose the
  // status code.
  return isErrorEnvelope(payload)
    ? payload.error
    : fallbackBody(status, `Request failed with status ${status}`, url);
}

/** A stand-in envelope for a failure the backend never got to describe. */
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
