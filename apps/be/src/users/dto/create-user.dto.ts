import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, MaxLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({
    format: "email",
    maxLength: 255,
    description: "Trimmed and lowercased before it is stored.",
    example: "ada@example.com",
  })
  // Normalized before validation so "  Ada@Example.com " and
  // "ada@example.com" cannot both slip past the unique constraint.
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;
}
