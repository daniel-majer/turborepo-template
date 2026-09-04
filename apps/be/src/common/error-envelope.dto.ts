import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** What AllExceptionsFilter puts in `error`. Nothing constructs it at runtime. */
class ApiErrorDto {
  @ApiProperty({ type: "integer", example: 404 })
  statusCode: number;

  @ApiProperty({ example: "User 42 not found" })
  message: string;

  @ApiPropertyOptional({
    type: [String],
    description: "One entry per failed constraint, on a validation error.",
    example: ["email must be an email"],
  })
  details?: string[];

  @ApiProperty({ format: "date-time", example: "2026-09-04T10:15:30.000Z" })
  timestamp: string;

  @ApiProperty({
    description: "The request path that failed.",
    example: "/users/42",
  })
  path: string;
}

/**
 * The wire shape of any failure. Referenced by the `default` response every
 * operation gets in swagger.setup.ts.
 */
export class ErrorEnvelopeDto {
  // OpenAPI 3.0 has no `type: "null"`; a nullable object says the same thing,
  // and this field is never anything but null.
  @ApiProperty({
    type: "object",
    nullable: true,
    additionalProperties: true,
    description: "Always null on the error path.",
  })
  data: null;

  @ApiProperty({ type: ApiErrorDto })
  error: ApiErrorDto;
}
