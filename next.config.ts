import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {"/*": ["./public/case/kras/**/*", "./scientific/**/*"]}
};

export default nextConfig;
