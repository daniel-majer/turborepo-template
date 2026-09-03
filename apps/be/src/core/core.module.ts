import { Module, ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigType } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";

import { CacheModule } from "../cache/cache.module.js";
import { AllExceptionsFilter } from "../common/all-exceptions.filter.js";
import { TransformResponseInterceptor } from "../common/transform-response.interceptor.js";
import {
  appConfig,
  databaseConfig,
  redisConfig,
  validateEnv,
} from "../config/index.js";
import { DatabaseModule } from "../database/database.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig, databaseConfig, redisConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        pinoHttp: {
          level:
            config.nodeEnv === "test"
              ? "silent"
              : config.nodeEnv === "development"
                ? "debug"
                : "info",
          transport:
            config.nodeEnv === "development"
              ? {
                  target: "pino-pretty",
                  options: {
                    colorize: true,
                    singleLine: true,
                  },
                }
              : undefined,
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers['set-cookie']",
          ],
        },
      }),
    }),
    DatabaseModule,
    CacheModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class CoreModule {}
