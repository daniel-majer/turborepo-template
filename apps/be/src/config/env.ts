import { z } from "zod";

// Require an allowed scheme and host while allowing localhost and Docker service names.
const urlWithScheme = (protocol: RegExp, expected: string) =>
  z.url({
    protocol,
    hostname: /./,
    error: `must be a ${expected} url including a host`,
  });

export const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

// TODO(template): add new variables here, in .env.example and in their *.config.ts.
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  // Override app.config.ts log-level defaults.
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  DATABASE_URL: urlWithScheme(/^postgres(ql)?$/, "postgres://"),
  REDIS_URL: urlWithScheme(/^rediss?$/, "redis://"),
  // Required: isolates cache keys and bounds clear() to one project.
  CACHE_NAMESPACE: z.string().min(1),
  // Comma-separated browser origins; empty allows none. No credentialed wildcards.
  CORS_ORIGINS: z.string().default(""),
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

// Validate once for all config namespaces.
export function getEnv(): Env {
  cached ??= validateEnv(process.env);
  return cached;
}
