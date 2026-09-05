import { defineConfig } from "vitest/config";

import { swaggerPlugin } from "./test/swagger-plugin.js";

export default defineConfig({
  plugins: [swaggerPlugin()],
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    exclude: ["**/*.int-spec.ts", "**/node_modules/**"],
  },
});
