import fastifyHelmet from "@fastify/helmet";
import type { ConfigType } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";

import { appConfig } from "./config/index.js";
import { setupSwagger } from "./swagger.setup.js";

/**
 * Everything that main.ts does to the app after `NestFactory.create`.
 * Shared with the e2e test setup so tests run against the same middleware
 * as the real server.
 */
export async function configureApp(app: NestFastifyApplication) {
  app.useLogger(app.get(Logger));
  await app.register(fastifyHelmet);

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // The generated client sends cookies (`credentials: "include"`), so the
  // browser requires an exact origin here and refuses a wildcard.
  //
  // `methods` is spelled out because the underlying @fastify/cors defaults to
  // GET, HEAD and POST only - leave it off and every PATCH and DELETE fails
  // its preflight in the browser while curl keeps working.
  app.enableCors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"],
  });

  if (config.nodeEnv !== "production") {
    setupSwagger(app);
  }
}
