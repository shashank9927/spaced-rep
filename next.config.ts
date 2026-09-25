import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Partial Prefetching keeps the shared application frame available while
  // private Supabase reads stream in. Private data is intentionally not put
  // in a shared server cache; see the private cache scopes in lib/auth.ts.
  cacheComponents: true,
  partialPrefetching: true,
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
