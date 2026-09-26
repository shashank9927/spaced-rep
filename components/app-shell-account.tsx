import { connection } from "next/server";
import { requireProfile } from "@/lib/auth";
import { AppShellControls } from "@/components/app-shell-controls";

export async function AppShellAccount() {
  // Auth claims and profile state are request-specific. Keep this private
  // shell segment out of prerendering while the surrounding navigation frame
  // remains available as the immediate static shell.
  await connection();
  const profile = await requireProfile();
  return <AppShellControls profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role, selected_catalog: profile.selected_catalog }} />;
}
