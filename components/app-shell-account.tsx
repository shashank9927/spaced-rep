import { requireProfile } from "@/lib/auth";
import { AppShellControls } from "@/components/app-shell-controls";

export async function AppShellAccount() {
  const profile = await requireProfile();
  return <AppShellControls profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role, selected_catalog: profile.selected_catalog }} />;
}
