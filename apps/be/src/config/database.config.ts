import { registerAs } from "@nestjs/config";

import { getEnv } from "./env.js";

export const databaseConfig = registerAs("database", () => ({
  url: getEnv().DATABASE_URL,
}));
