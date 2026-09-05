import { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { appConfig } from "./config/index.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  await configureApp(app);
  // Buffered bootstrap logs would otherwise be lost on a failure below.
  app.flushLogs();
  // Close the Prisma pool on SIGTERM.
  app.enableShutdownHooks();

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  // Fastify binds to localhost by default; a container needs 0.0.0.0.
  await app.listen(config.port, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  // The logger may not exist yet.
  console.error(error);
  process.exit(1);
});
