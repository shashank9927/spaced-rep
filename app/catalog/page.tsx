import { AppShell } from "@/components/app-shell";
import { CatalogClient } from "@/components/catalog-client";
import { requireProfile } from "@/lib/auth";
import { getCatalogProblems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const profile = await requireProfile();
  const problems = await getCatalogProblems(profile.selected_catalog);
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }}><section className="page-heading compact-heading"><div><span className="eyebrow">Problem library</span><h1>What have you solved?</h1><p>Log a first solve to turn a problem into a review card. The same history follows it across every list.</p></div></section><CatalogClient initialCatalog={profile.selected_catalog} problems={problems} /></AppShell>;
}
