import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CacheService } from "../cache/cache.service.js";
import { ApiDataResponse } from "../common/api-data-response.decorator.js";
import { DatabaseService } from "../database/database.service.js";
import { LivenessDto, ReadinessDto, type Status } from "./health.dto.js";

// Bound probe duration.
const CHECK_TIMEOUT_MS = 2_000;

// Probe key expires automatically.
const HEALTH_KEY = "__health__";
const HEALTH_KEY_TTL_MS = 1_000;

/**
 * Use /health/live for restarts and /health/ready for traffic routing.
 * Database failure is unready; cache failure is degraded but ready.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Is the process alive? Wire restart policies here" })
  @ApiDataResponse(LivenessDto)
  live(): LivenessDto {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Can it serve traffic? Wire healthchecks here" })
  @ApiDataResponse(ReadinessDto)
  async ready(): Promise<ReadinessDto> {
    const [database, cache] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    if (database === "down") {
      // Return 503 so healthchecks stop routing traffic.
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: "database unreachable",
      });
    }

    return {
      status: cache === "up" ? "ok" : "degraded",
      checks: { database, cache },
    };
  }

  private async checkDatabase(): Promise<Status> {
    try {
      await withTimeout(this.database.$queryRaw`SELECT 1`);

      return "up";
    } catch (error) {
      this.logger.error(error, "readiness: database check failed");

      return "down";
    }
  }

  private async checkCache(): Promise<Status> {
    try {
      // Probe with a write: failed reads look like cache misses.
      await withTimeout(this.cache.set(HEALTH_KEY, true, HEALTH_KEY_TTL_MS));

      return "up";
    } catch (error) {
      this.logger.warn(error, "readiness: cache check failed");

      return "down";
    }
  }
}

async function withTimeout<T>(work: PromiseLike<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`health check timed out after ${CHECK_TIMEOUT_MS}ms`),
            ),
          CHECK_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    // Do not keep the event loop alive after the probe finishes.
    clearTimeout(timer);
  }
}
