import { createMock } from "@golevelup/ts-vitest";
import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { AllExceptionsFilter } from "./all-exceptions.filter.js";

// Capture the filter's HTTP status and response body.
function catchException(exception: unknown) {
  const send = vi.fn((_body: unknown) => undefined);
  const status = vi.fn((_code: number) => ({ send }));
  const host = createMock<ArgumentsHost>({
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: "/users/42", id: "test-request-id" }),
    }),
  });

  new AllExceptionsFilter().catch(exception, host);

  return { status: status.mock.calls[0]?.[0], body: send.mock.calls[0]?.[0] };
}

describe("AllExceptionsFilter", () => {
  let logError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logError.mockRestore();
  });

  it("answers an HttpException in the same envelope the success path uses", () => {
    const { body, status } = catchException(
      new NotFoundException("User not found"),
    );

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body).toEqual({
      data: null,
      error: {
        statusCode: 404,
        message: "User not found",
        timestamp: expect.any(String),
        path: "/users/42",
        requestId: "test-request-id",
      },
    });
  });

  it("lists the failed constraints of a validation error under details", () => {
    // The shape the global ValidationPipe throws.
    const { body } = catchException(
      new BadRequestException({
        statusCode: 400,
        message: ["email must be an email", "name should not be empty"],
        error: "Bad Request",
      }),
    );

    expect(body).toMatchObject({
      data: null,
      error: {
        statusCode: 400,
        message: "Validation failed",
        details: ["email must be an email", "name should not be empty"],
      },
    });
  });

  it("reduces an unknown exception to a bare 500 instead of leaking its message", () => {
    const { body, status } = catchException(
      new Error(
        "connect ECONNREFUSED 10.0.0.5:5432 - password authentication failed",
      ),
    );

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toMatchObject({
      data: null,
      error: { statusCode: 500, message: "Internal Server Error" },
    });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("logs an unknown exception, because nothing about it survives in the response", () => {
    catchException(new Error("boom"));

    expect(logError).toHaveBeenCalled();
  });

  it("does not log a 4xx, which pino-http already records at warn", () => {
    catchException(new BadRequestException("nope"));

    expect(logError).not.toHaveBeenCalled();
  });

  it("keeps the message of a 5xx that was raised deliberately", () => {
    const { body, status } = catchException(
      new HttpException("upstream said no", HttpStatus.BAD_GATEWAY),
    );

    expect(status).toBe(HttpStatus.BAD_GATEWAY);
    // Explicit HTTP exception messages are safe to return.
    expect(body).toMatchObject({
      error: { statusCode: 502, message: "upstream said no" },
    });
  });
});
