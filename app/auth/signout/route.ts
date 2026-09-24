import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { configuredSiteUrl } from "@/lib/security";

export async function POST(request: Request) {
  const configured = configuredSiteUrl();
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" && configured && origin && origin !== configured.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

// Sign-out changes the session and must never be triggered by a cross-site GET.
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login?message=Use+the+account+menu+to+sign+out.", request.url), { status: 303 });
}
