import { Module, ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigType } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { LoggerModule, type Params } from "nestjs-pino";
import {
  multistream,
  type SerializedRequest,
  type SerializedResponse,
} from "pino";
import type { Options } from "pino-http";

import { CacheModule } from "../cache/cache.module.js";
import { AllExceptionsFilter } from "../common/all-exceptions.filter.js";
import { TransformResponseInterceptor } from "../common/transform-response.interceptor.js";
import {
  appConfig,
  databaseConfig,
  envFilePath,
  overrideEnvFile,
  redisConfig,
  validateEnv,
} from "../config/index.js";
import { DatabaseModule } from "../database/database.module.js";
import { HealthModule } from "../health/health.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      override: overrideEnvFile,
      validate: validateEnv,
      load: [appConfig, databaseConfig, redisConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>): Params => {
        const options: Options = {
          level: config.logLevel,
          autoLogging: {
            // Skip repetitive healthcheck access logs.
            ignore: (request) => request.url?.startsWith("/health") ?? false,
          },
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers['set-cookie']",
          ],
          serializers: {
            req({ query: _query, ...request }: SerializedRequest) {
              // The query string can carry tokens.
              return {
                ...request,
                url: request.url.split("?")[0] ?? request.url,
              };
            },
            res({ headers, ...response }: SerializedResponse) {
              // Omit repetitive response headers.
              return { ...response, contentLength: headers["content-length"] };
            },
          },
          customLogLevel: (_request, response, error) => {
            if (error || response.statusCode >= 500) {
              return "error";
            }
            if (response.statusCode >= 400) {
              return "warn";
            }
            return "info";
          },
        };

        if (config.nodeEnv === "development") {
          return {
            pinoHttp: {
              ...options,
              transport: {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: "SYS:HH:MM:ss.l",
                },
              },
            },
          };
        }

        // Route errors to stderr without duplicating them on stdout.
        return {
          pinoHttp: [
            options,
            multistream(
              [
                { level: "trace", stream: process.stdout },
                { level: "error", stream: process.stderr },
              ],
              { dedupe: true },
            ),
          ],
        };
      },
    }),
    DatabaseModule,
    CacheModule,
    HealthModule,
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
