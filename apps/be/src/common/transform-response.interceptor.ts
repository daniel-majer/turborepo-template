import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { map, Observable } from "rxjs";

interface Envelope {
  data: unknown;
  meta?: unknown;
}

function hasMeta(value: unknown): value is { data: unknown; meta: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "meta" in value
  );
}

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<Envelope> {
    return next.handle().pipe(
      map((response: unknown): Envelope => {
        if (response == null) return { data: null };
        if (hasMeta(response)) return response;
        return { data: response };
      }),
    );
  }
}
