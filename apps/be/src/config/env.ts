import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  // Where the browser loads the frontend from. CORS is an allowlist of exact
  // origins because the api answers with cookies; "*" is not an option once
  // credentials are involved.
  FRONTEND_URL: z.url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= validateEnv(process.env);
  return cached;
}
