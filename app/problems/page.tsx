import { AppShell } from "@/components/app-shell";
import { CatalogClient } from "@/components/catalog-client";
import { requireProfile } from "@/lib/auth";
import { getCatalogProblems, getProgressData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProblemsPage() {
  const profile = await requireProfile();
  const [problems, progress] = await Promise.all([getCatalogProblems(profile.selected_catalog), getProgressData()]);
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }} streak={progress?.stats.currentStreak}>
    <section className="page-heading compact-heading"><div><span className="eyebrow">Problem library</span><h1>Problems</h1><p>Every solved problem stays in your own review history across all study lists.</p></div></section>
    <CatalogClient initialCatalog={profile.selected_catalog} problems={problems} />
  </AppShell>;
}
