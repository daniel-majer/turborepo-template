import { defineConfig } from "vitest/config";

import { swaggerPlugin } from "./test/swagger-plugin.js";

export default defineConfig({
  plugins: [swaggerPlugin()],
  test: {
    globals: true,
    root: "./",
    include: ["**/*.e2e-spec.ts", "**/*.int-spec.ts"],
    fileParallelism: false,
  },
});
