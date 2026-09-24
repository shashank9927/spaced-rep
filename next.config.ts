import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "64kb",
      allowedOrigins: [new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").host],
    },
  },
  serverExternalPackages: ["ts-fsrs"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
