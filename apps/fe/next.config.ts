import path from "node:path";

import type { NextConfig } from "next";

// Validate build-time env; instrumentation validates at server startup.
import "./src/env";

const nextConfig: NextConfig = {
  // Standalone output for the Docker image.
  output: "standalone",
  reactCompiler: true,
  typedRoutes: true,
  turbopack: {
    // Resolve workspace packages from the monorepo root.
    root: path.join(import.meta.dirname, "..", ".."),
  },
};

export default nextConfig;
