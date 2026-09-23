import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ts-fsrs"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
