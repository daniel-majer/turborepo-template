import { writeFile } from "node:fs/promises";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";

// Writes openapi.json, the contract the frontend's client is generated from.
// Committed rather than produced on demand, so a fresh clone can generate a
// client with no backend running, and so a change to the api shows up as a
// reviewable diff in the same commit as the code that caused it.
//
//   bun run api:spec
//
// Runs from dist, not from source: the generated Prisma client imports its own
// files with .js extensions while they are .ts on disk.
const OUTPUT = new URL("../../openapi.json", import.meta.url);

// The document is built from decorator metadata alone - nothing connects. The
// placeholders only get ConfigModule's schema past the door on a machine (or a
// CI job) with no .env, and are never dialled.
process.env.DATABASE_URL ??=
  "postgresql://openapi:openapi@localhost:5432/openapi";
process.env.REDIS_URL ??= "redis://localhost:6379";

async function generate() {
  // Imported after the placeholders are in place: ConfigModule validates the
  // environment while the module graph is being evaluated.
  const { AppModule } = await import("../app.module.js");
  const { buildOpenApiDocument } = await import("../swagger.setup.js");

  // The adapter is explicit: NestFactory.create without one falls back to
  // @nestjs/platform-express, which this app neither declares nor runs. Under
  // an installer that skips optional peers the script dies on a missing
  // module, and where it does resolve the spec is built by a different server
  // than the one that serves it.
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
    // Preview mode registers controllers and their metadata without
    // instantiating providers, which is what keeps this runnable with no
    // Postgres and no Redis.
    preview: true,
    logger: false,
  });

  const document = buildOpenApiDocument(app);

  // Two-space indent and a trailing newline: what an editor and `git diff`
  // both expect, so the file does not churn on the next write.
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
