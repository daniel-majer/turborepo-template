import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { databaseConfig } from "../config/index.js";
import { PrismaClient } from "./generated/client.js";

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject(databaseConfig.KEY) config: ConfigType<typeof databaseConfig>,
  ) {
    super({
      adapter: new PrismaPg({
        connectionString: config.url,
        connectionTimeoutMillis: 5_000,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    // The pg adapter connects lazily; query once to fail startup if the DB is unavailable.
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
