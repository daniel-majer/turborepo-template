import { env } from "./env";

/** Validate at server startup, including images built with validation disabled. */
export function register() {
  // Read a value to keep the env import from being tree-shaken.
  console.info(`[env] validated, NODE_ENV=${env.NODE_ENV}`);
}
