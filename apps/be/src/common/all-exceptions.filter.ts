import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";

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

    void response.status(statusCode).send({
      statusCode,
      ...this.extractMessage(exception),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private extractMessage(exception: unknown) {
    if (!(exception instanceof HttpException)) {
      return { message: "Internal Server Error" };
    }

    // getResponse() is either a string ("Unauthorized") or an object,
    // e.g. ValidationPipe's { message: [...], error, statusCode }.
    const res = exception.getResponse();
    return typeof res === "string" ? { message: res } : res;
  }
}
