import { registerAs } from "@nestjs/config";

import { getEnv } from "./env.js";

const DEFAULT_LOG_LEVEL = {
  development: "debug",
  test: "silent",
  production: "info",
} as const;

export const appConfig = registerAs("app", () => {
  const env = getEnv();

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    isProduction: env.NODE_ENV === "production",
    logLevel: env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL[env.NODE_ENV],
    // Trim origins and discard empty entries.
    corsOrigins: env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  };
});
