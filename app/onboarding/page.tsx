import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireProfile } from "@/lib/auth";
import { displayNameFromEmail } from "@/lib/utils";
import { Suspense } from "react";

async function OnboardingContent() {
  const profile = await requireProfile({ onboarding: true });
  if (profile.display_name) redirect("/today");
  return <main className="grid min-h-dvh place-items-center bg-background px-4 py-16 text-foreground"><ThemeToggle /><section className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"><span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground"><Compass size={20} /></span><p className="mt-5 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground">Set up your practice space</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Make the queue yours.</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">One minute now, then RecallCode can track what future-you needs to revisit.</p><OnboardingForm suggestedName={displayNameFromEmail(profile.email)} /></section></main>;
}

export default function OnboardingPage() { return <Suspense fallback={null}><OnboardingContent /></Suspense>; }
