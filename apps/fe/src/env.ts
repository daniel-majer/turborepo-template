import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    /** Server-only API address; falls back to NEXT_PUBLIC_API_URL. */
    API_URL: z.url().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    /** Build-time browser API URL; unset means same origin. */
    NEXT_PUBLIC_API_URL: z.url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  emptyStringAsUndefined: true,
  // Skip validation for CI/image builds; instrumentation validates at server startup.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
