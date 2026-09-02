import { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";
import { appConfig } from "./config/index.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(config.port, "0.0.0.0");
}
await bootstrap();
