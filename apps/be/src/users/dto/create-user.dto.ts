import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, MaxLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({
    description: "Trimmed and lowercased before it is stored.",
    example: "ada@example.com",
  })
  // Normalize before validation and unique checks.
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;
}
