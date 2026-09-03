import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env" });

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "src/database/schema.prisma",
  migrations: {
    path: "src/database/migrations",
  },
  ...(url ? { datasource: { url } } : {}),
});
