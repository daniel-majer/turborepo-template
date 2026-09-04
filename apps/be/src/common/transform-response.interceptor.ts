import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { map, Observable } from "rxjs";

export interface Envelope<T> {
  data: T | null;
  meta?: unknown;
}

/**
 * Marks an envelope a handler built on purpose. Recognising the shape instead
 * - "it has data and meta keys" - cannot tell an envelope from a row that
 * happens to have those columns, and lets it out unwrapped. A symbol collides
 * with no column name, and JSON.stringify ignores it, so it never ships.
 */
const ENVELOPE = Symbol("envelope");

/**
 * How to return metadata beside the payload:
 *
 *   return envelope(users, { total, page });
 *
 * The common case needs nothing - return the value and the interceptor wraps
 * it. A hand-built `{ data: ... }` is deliberately NOT recognised and would
 * end up nested inside a second envelope.
 */
export function envelope<T>(data: T | null, meta?: unknown): Envelope<T> {
  const value: Envelope<T> = meta === undefined ? { data } : { data, meta };

  // Non-enumerable, so it survives neither JSON nor a spread.
  Object.defineProperty(value, ENVELOPE, { value: true, enumerable: false });

  return value;
}

function isEnvelope<T>(value: unknown): value is Envelope<T> {
  return typeof value === "object" && value !== null && ENVELOPE in value;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  Envelope<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((response): Envelope<T> => {
        if (response === null || response === undefined) return { data: null };
        if (isEnvelope<T>(response)) return response;
        return { data: response };
      }),
    );
  }
}
