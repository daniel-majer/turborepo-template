import { registerAs } from "@nestjs/config";

import { getEnv } from "./env.js";

export const redisConfig = registerAs("redis", () => {
  const env = getEnv();

  return {
    url: env.REDIS_URL,
    // Prefixes every key and bounds what clear() wipes.
    namespace: env.CACHE_NAMESPACE,
  };
});
