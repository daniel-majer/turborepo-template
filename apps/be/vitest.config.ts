import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    exclude: ["**/*.int-spec.ts", "**/node_modules/**"],
  },
});
