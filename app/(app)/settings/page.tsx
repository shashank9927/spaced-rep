import { Settings } from "lucide-react";
import { SettingsForm } from "@/components/settings-form";
import { requireProfile } from "@/lib/auth";

export default async function SettingsPage() {
  const profile = await requireProfile();
  return <><section className="page-heading compact-heading"><div><span className="eyebrow">Account</span><h1>Settings</h1><p>Keep your practice space, study targets, and local day boundaries accurate.</p></div></section><section className="settings-card"><div className="section-title"><span><Settings size={21} /> Your preferences</span></div><SettingsForm displayName={profile.display_name!} timezone={profile.timezone} selectedCatalog={profile.selected_catalog} studyPlan={{ easyPerDay: profile.new_easy_per_day ?? 0, mediumPerDay: profile.new_medium_per_day ?? 0, hardPerDay: profile.new_hard_per_day ?? 0, studyDays: profile.study_days ?? ["mon", "tue", "wed", "thu", "fri"], configured: Boolean(profile.study_plan_configured_at) }} /></section></>;
}
