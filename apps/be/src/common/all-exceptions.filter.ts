import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";

export interface ApiError {
  statusCode: number;
  message: string;
  /** One entry per failed constraint, on a validation error. */
  details?: string[];
  timestamp: string;
  path: string;
}

export interface ErrorEnvelope {
  data: null;
  error: ApiError;
}

/**
 * The error half of the response contract. Failures are enveloped just like
 * successes - `data` is null and `error` says what went wrong - so a client
 * reads `.data` on every response instead of branching on the shape.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Unknown errors are bugs - keep the stack trace in the logs,
    // but never leak it to the client.
    if (!isHttpException) {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : exception,
      );
    }

    const body: ErrorEnvelope = {
      data: null,
      error: {
        statusCode,
        ...describeException(exception),
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    void response.status(statusCode).send(body);
  }
}

function describeException(exception: unknown): {
  message: string;
  details?: string[];
} {
  if (!(exception instanceof HttpException)) {
    // Deliberately generic: internals are for the log, not for the caller.
    return { message: "Internal Server Error" };
  }

  // getResponse() is either a string ("Unauthorized") or an object,
  // e.g. ValidationPipe's { message: [...], error, statusCode }.
  const response = exception.getResponse();
  if (typeof response === "string") return { message: response };

  const message = (response as { message?: unknown }).message;

  // ValidationPipe reports one string per failed constraint, so the list is
  // the useful part and a summary line is what belongs in `message`.
  if (Array.isArray(message)) {
    return { message: "Validation failed", details: message.map(String) };
  }

  return { message: typeof message === "string" ? message : exception.message };
}
