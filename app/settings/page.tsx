import { Settings } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { requireProfile } from "@/lib/auth";
import { getProgressData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const progress = await getProgressData();
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }} streak={progress?.stats.currentStreak}>
    <section className="page-heading compact-heading"><div><span className="eyebrow">Account</span><h1>Settings</h1><p>Keep your practice space and local day boundaries accurate.</p></div></section>
    <section className="settings-card"><div className="section-title"><span><Settings size={21} /> Your preferences</span></div><SettingsForm displayName={profile.display_name!} timezone={profile.timezone} selectedCatalog={profile.selected_catalog} /></section>
  </AppShell>;
}
