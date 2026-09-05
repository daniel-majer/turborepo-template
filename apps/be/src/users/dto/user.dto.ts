import { ApiProperty } from "@nestjs/swagger";

import type { User } from "../../database/generated/client.js";

/** Explicit public fields prevent new database columns from leaking through the API. */
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
