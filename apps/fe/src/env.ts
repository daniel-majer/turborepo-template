import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    /**
     * How this process reaches the api from inside the network - a Docker
     * service name rather than a public host. Optional: without it server-side
     * calls fall back to NEXT_PUBLIC_API_URL, which is right on a laptop.
     */
    API_URL: z.url().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    /** Public address of the api, compiled into the browser bundle. */
    NEXT_PUBLIC_API_URL: z.url(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  emptyStringAsUndefined: true,
});
