import { ApiProperty } from "@nestjs/swagger";

import type { User } from "../../database/generated/client.js";

/**
 * The public shape of a user. Built explicitly instead of returning the
 * Prisma model, so adding a column (password hash, tokens, ...) never leaks
 * it through the API by accident.
 */
export class UserDto {
  @ApiProperty({ type: "integer", example: 1 })
  id: number;

  @ApiProperty({ format: "email", example: "ada@example.com" })
  email: string;

  @ApiProperty({ format: "date-time" })
  createdAt: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt: Date;

  static from(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
