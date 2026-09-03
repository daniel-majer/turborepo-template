import fastifyHelmet from "@fastify/helmet";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";

/**
 * Everything that main.ts does to the app after `NestFactory.create`.
 * Shared with the e2e test setup so tests run against the same middleware
 * as the real server.
 */
export async function configureApp(app: NestFastifyApplication) {
  app.useLogger(app.get(Logger));
  await app.register(fastifyHelmet);
}
