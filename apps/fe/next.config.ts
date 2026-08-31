import type { NextConfig } from "next";

import "./src/env";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typedRoutes: true,
};

export default nextConfig;
