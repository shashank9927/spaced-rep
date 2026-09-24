import { NextResponse } from "next/server";
import { claimAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { configuredSiteUrl, requestCorrelationId } from "@/lib/security";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const correlationId = requestCorrelationId();
  const configured = configuredSiteUrl();
  if (process.env.NODE_ENV === "production" && !configured) {
    console.error(`[oauth:${correlationId}] NEXT_PUBLIC_SITE_URL is not configured`);
    return NextResponse.redirect(new URL("/login?message=Sign-in+is+temporarily+unavailable.+Please+contact+the+owner.", url.origin));
  }
  if (configured && process.env.NODE_ENV === "production" && url.origin !== configured.origin) {
    console.warn(`[oauth:${correlationId}] callback origin rejected`);
    return NextResponse.redirect(new URL("/login?message=Sign-in+must+start+from+the+configured+app+address.", configured.origin));
  }
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?message=Google+did+not+return+a+sign-in+code.", url.origin));
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn(`[oauth:${correlationId}] code exchange failed`, { code: error.code });
      return NextResponse.redirect(new URL("/login?message=Google+sign-in+could+not+be+completed.+Please+try+again.", url.origin));
    }
    const claim = await claimAuthenticatedUser(data.user);
    if (!claim.allowed) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/denied", url.origin));
    }
    return NextResponse.redirect(new URL(claim.needsOnboarding ? "/onboarding" : "/today", url.origin));
  } catch (error) {
    console.error(`[oauth:${correlationId}] callback failed`, error instanceof Error ? { name: error.name } : undefined);
    return NextResponse.redirect(new URL("/login?message=We+could+not+verify+your+invite.+Check+the+app+setup+and+try+again.", url.origin));
  }
}
