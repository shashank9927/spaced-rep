import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile } from "@/lib/auth";

async function HomeRedirect(): Promise<never> {
  const profile = await getProfile();
  return redirect(profile ? (profile.display_name ? "/today" : "/onboarding") : "/login");
}

export default function Home() { return <Suspense fallback={null}><HomeRedirect /></Suspense>; }
