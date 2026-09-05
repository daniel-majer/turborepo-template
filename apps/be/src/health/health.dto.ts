import { ApiProperty } from "@nestjs/swagger";

// DTOs type controller responses and provide Swagger metadata.

export type Status = "up" | "down";

export class LivenessDto {
  @ApiProperty({ enum: ["ok"], example: "ok" })
  status: "ok";
}

class HealthChecksDto {
  @ApiProperty({ enum: ["up", "down"], example: "up" })
  database: Status;

  @ApiProperty({ enum: ["up", "down"], example: "up" })
  cache: Status;
}

export class ReadinessDto {
  @ApiProperty({
    enum: ["ok", "degraded"],
    description:
      '"degraded" means the cache is unreachable; the api still serves requests',
    example: "ok",
  })
  status: "ok" | "degraded";

  @ApiProperty({ type: HealthChecksDto })
  checks: HealthChecksDto;
}
