import { ApiProperty } from "@nestjs/swagger";

export class UsersPageMetaDto {
  @ApiProperty({ type: "integer", nullable: true, example: 20 })
  nextCursor: number | null;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}
