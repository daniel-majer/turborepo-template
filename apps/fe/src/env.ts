import { validateApiBaseUrl } from "@repo/api-client/fetcher";
import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

// Required even when other build-time validation is skipped.
const publicApiUrl = validateApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL,
  "NEXT_PUBLIC_API_URL",
);

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    /** Server-only API address; falls back to NEXT_PUBLIC_API_URL. */
    API_URL: z.url({ protocol: /^https?$/ }).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    /** Explicit build-time API address, separate from frontend page routes. */
    NEXT_PUBLIC_API_URL: z.url({ protocol: /^https?$/ }),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: publicApiUrl,
  },
  emptyStringAsUndefined: true,
  // Skip validation for CI/image builds; instrumentation validates at server startup.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
