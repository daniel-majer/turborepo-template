import { registerAs } from "@nestjs/config";

import { getEnv } from "./env.js";

export const appConfig = registerAs("app", () => {
  const env = getEnv();

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendUrl: env.FRONTEND_URL,
  };
});
