import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/*": [
      "./public/case/kras/**/*",
      "./scientific/**/*.py",
      "./scripts/database-lock.py",
    ],
  },
};

export default nextConfig;
