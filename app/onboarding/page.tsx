import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireProfile } from "@/lib/auth";
import { displayNameFromEmail } from "@/lib/utils";

export default async function OnboardingPage() {
  const profile = await requireProfile({ onboarding: true });
  if (profile.display_name) redirect("/today");
  return <main className="onboarding-page"><ThemeToggle /><section className="onboarding-card"><span className="onboarding-icon"><Compass size={24} /></span><span className="eyebrow">Set up your practice space</span><h1>Make the queue yours.</h1><p>One minute now, then the app can keep track of what future-you needs to revisit.</p><OnboardingForm suggestedName={displayNameFromEmail(profile.email)} /></section></main>;
}
