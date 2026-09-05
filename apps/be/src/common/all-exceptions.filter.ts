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
  /** Validation failures. */
  details?: string[];
  timestamp: string;
  path: string;
}

export interface ErrorEnvelope {
  data: null;
  error: ApiError;
}

/** Normalize failures to { data: null, error }. */
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

    // Log unexpected failures without exposing internals to clients.
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
    return { message: "Internal Server Error" };
  }

  // HTTP exceptions may contain a string or a validation object.
  const response = exception.getResponse();
  if (typeof response === "string") return { message: response };

  const message = (response as { message?: unknown }).message;

  // Preserve individual validation failures in details.
  if (Array.isArray(message)) {
    return { message: "Validation failed", details: message.map(String) };
  }

  return { message: typeof message === "string" ? message : exception.message };
}
