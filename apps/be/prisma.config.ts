import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// No src/ imports: migrations run in the production image.
// Keep env loading aligned with src/config/env-file.ts.
const isTest = process.env.NODE_ENV === "test";
config({ path: isTest ? ".env.test" : ".env", override: isTest });

// Allow prisma generate without DATABASE_URL; connecting commands still require it.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "src/database/schema.prisma",
  migrations: {
    path: "src/database/migrations",
    seed: "bun run src/database/seed.ts",
  },
  ...(url ? { datasource: { url } } : {}),
});
