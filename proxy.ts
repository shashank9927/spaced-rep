import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-route", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Public pages still receive the security headers below, but only protected
  // routes need a session refresh. Avoiding Auth work for public/static
  // navigation keeps the proxy out of the critical path where possible.
  const protectedPaths = ["/", "/today", "/problems", "/review", "/schedule", "/progress", "/settings", "/admin", "/onboarding", "/dashboard", "/catalog", "/history", "/insights", "/patterns"];
  const shouldRefreshSession = protectedPaths.some((path) => path === "/"
    ? request.nextUrl.pathname === path
    : request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`));
  if (url && key && shouldRefreshSession) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          }));
        },
      },
    });
    // getClaims validates asymmetric JWTs against a cached JWKS instead of
    // making getUser's Auth request on every RSC navigation.
    await supabase.auth.getClaims();
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("X-Frame-Options", "DENY");
  if (process.env.NODE_ENV === "production") {
    const supabaseOrigin = url ? (() => { try { return new URL(url).origin; } catch { return ""; } })() : "";
    const connectSources = ["'self'", supabaseOrigin].filter(Boolean).join(" ");
    const contentSecurityPolicy = [
      "default-src 'self'",
      // Cache Components and Partial Prerendering stream framework bootstrap
      // scripts into the static shell. A per-request nonce cannot be attached
      // to those scripts, so a nonce-only policy blocks Next's React streaming
      // runtime and leaves `$RC` undefined on client navigation. Keep the
      // performance architecture and use Next's supported static CSP shape.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "style-src-attr 'unsafe-inline'",
      `connect-src ${connectSources}`,
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "frame-src 'self'",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ];
    if (process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")) contentSecurityPolicy.push("upgrade-insecure-requests");
    response.headers.set("Content-Security-Policy", contentSecurityPolicy.join("; "));
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
