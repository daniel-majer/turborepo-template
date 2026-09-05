import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map, Observable } from "rxjs";

import { RAW_RESPONSE } from "./raw-response.decorator.js";

export interface Envelope<T, M = unknown> {
  data: T | null;
  meta?: M;
}

// Explicit marker avoids confusing payload fields with envelopes.
// A string survives cache JSON serialization; it is stripped from the response.
const ENVELOPE_MARKER = "__envelope__";

type MarkedEnvelope<T, M = unknown> = Envelope<T, M> & {
  [ENVELOPE_MARKER]: true;
};

/**
 * Add metadata with envelope(data, meta); plain values are wrapped automatically.
 * Hand-built { data } objects are treated as payloads, not envelopes.
 */
export function envelope<T, M = unknown>(
  data: T | null | undefined,
  meta?: M,
): Envelope<NonNullable<T>, M> {
  // Use null so JSON retains the required data field.
  const value: MarkedEnvelope<NonNullable<T>, M> = meta === undefined
    ? { data: data ?? null, [ENVELOPE_MARKER]: true }
    : { data: data ?? null, meta, [ENVELOPE_MARKER]: true };

  return value;
}

function isEnvelope<T>(value: unknown): value is MarkedEnvelope<T> {
  return (
    typeof value === "object" && value !== null && ENVELOPE_MARKER in value
  );
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  Envelope<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Envelope<T> | T> {
    // Bypass wrapping for streams, SSE and redirects.
    const raw = this.reflector.get<boolean | undefined>(
      RAW_RESPONSE,
      context.getHandler(),
    );
    if (raw === true) {
      return next.handle();
    }

    return next.handle().pipe(
      map((response): Envelope<T> => {
        if (response === null || response === undefined) return { data: null };
        if (isEnvelope<T>(response)) {
          // Strip the internal marker.
          const { data, meta } = response;

          return meta === undefined ? { data } : { data, meta };
        }
        return { data: response };
      }),
    );
  }
}
