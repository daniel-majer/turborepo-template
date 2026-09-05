import fastifyHelmet from "@fastify/helmet";
import { Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger as PinoLogger } from "nestjs-pino";

import { appConfig } from "./config/index.js";
import { setupSwagger } from "./swagger.setup.js";

/** Shared middleware setup for the server and integration tests. */
export async function configureApp(app: NestFastifyApplication) {
  app.useLogger(app.get(PinoLogger));
  await app.register(fastifyHelmet);

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // Report browser-only CORS failures at startup.
  if (config.corsOrigins.length === 0) {
    new Logger("configureApp").warn(
      "CORS_ORIGINS is empty - a browser on another origin cannot call this api. " +
        "Set it to the frontend's origin, e.g. http://localhost:3000",
    );
  } else {
    // Cookie requests require explicit origins; wildcards are invalid.
    // Allow PATCH/PUT/DELETE explicitly so their preflight requests succeed.
    app.enableCors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"],
    });
  }

  if (!config.isProduction) {
    setupSwagger(app);
  }
}
