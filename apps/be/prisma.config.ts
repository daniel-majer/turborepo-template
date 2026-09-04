import { config } from "dotenv";
import { defineConfig } from "prisma/config";

import { envFilePath, overrideEnvFile } from "./src/config/index.js";

config({ path: envFilePath, override: overrideEnvFile });

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "src/database/schema.prisma",
  migrations: {
    path: "src/database/migrations",
  },
  ...(url ? { datasource: { url } } : {}),
});
