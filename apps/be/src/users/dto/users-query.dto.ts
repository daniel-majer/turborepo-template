import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class UsersQueryDto {
  @ApiPropertyOptional({
    type: "integer",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take = 20;

  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: 2_147_483_647,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  cursor?: number;
}
