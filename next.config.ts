import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  experimental: {
    optimizePackageImports: ["socket.io-client"]
  }
};

export default nextConfig;
