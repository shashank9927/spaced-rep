import { NextResponse } from "next/server";
import { claimAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?message=Google+did+not+return+a+sign-in+code.", url.origin));
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?message=${encodeURIComponent(error.message)}`, url.origin));
    const claim = await claimAuthenticatedUser(data.user);
    if (!claim.allowed) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/denied", url.origin));
    }
    return NextResponse.redirect(new URL(claim.needsOnboarding ? "/onboarding" : "/dashboard", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?message=We+could+not+verify+your+invite.+Check+the+app+setup+and+try+again.", url.origin));
  }
}
