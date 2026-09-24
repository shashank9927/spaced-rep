import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }}>{children}</AppShell>;
}
