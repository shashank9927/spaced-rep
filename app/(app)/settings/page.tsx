import { SettingsForm } from "@/components/settings-form";
import { RouteLoading } from "@/components/route-loading";
import { requireProfile } from "@/lib/auth";
import { Suspense } from "react";

async function SettingsContent() {
  const profile = await requireProfile();
  return <SettingsForm displayName={profile.display_name!} timezone={profile.timezone} selectedCatalog={profile.selected_catalog} />;
}

export default function SettingsPage() { return <Suspense fallback={<RouteLoading variant="detail" />}><SettingsContent /></Suspense>; }
