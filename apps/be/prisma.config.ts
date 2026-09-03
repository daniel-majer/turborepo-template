import "dotenv/config";
import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "src/database/schema.prisma",
  migrations: {
    path: "src/database/migrations",
  },
  ...(url ? { datasource: { url } } : {}),
});
