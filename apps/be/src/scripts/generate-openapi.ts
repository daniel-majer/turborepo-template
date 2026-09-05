import { writeFile } from "node:fs/promises";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";

// Generate the committed contract with bun run api:spec; no running services needed.
// Run compiled output so Prisma's .js imports resolve.
const OUTPUT = new URL("../../openapi.json", import.meta.url);

// Placeholders satisfy env validation; preview mode never connects to these services.
process.env.DATABASE_URL ??=
  "postgresql://openapi:openapi@localhost:5432/openapi";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.CACHE_NAMESPACE ??= "openapi";

async function generate() {
  // Import after setting placeholders: ConfigModule validates during module loading.
  const { AppModule } = await import("../app.module.js");
  const { API_PREFIX } = await import("../api-prefix.js");
  const { buildOpenApiDocument } = await import("../swagger.setup.js");

  // Use the production adapter; Nest otherwise defaults to Express.
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
    // Read decorator metadata without instantiating providers.
    preview: true,
    logger: false,
  });

  app.setGlobalPrefix(API_PREFIX);

  const document = buildOpenApiDocument(app);

  await writeFile(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();

  console.log(
    `openapi.json written: ${Object.keys(document.paths).length} paths`,
  );
}

generate().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
