import { SettingsForm } from "@/components/settings-form";
import { requireProfile } from "@/lib/auth";

export default async function SettingsPage() {
  const profile = await requireProfile();
  return <SettingsForm displayName={profile.display_name!} timezone={profile.timezone} selectedCatalog={profile.selected_catalog} />;
}
