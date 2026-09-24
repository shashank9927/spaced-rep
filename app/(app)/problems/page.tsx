import { CatalogClient } from "@/components/catalog-client";
import { requireProfile } from "@/lib/auth";
import { getCatalogProblems } from "@/lib/queries";

export default async function ProblemsPage() {
  const profile = await requireProfile();
  const problems = await getCatalogProblems(profile.selected_catalog);
  return <><section className="page-heading compact-heading"><div><span className="eyebrow">Problem library</span><h1>Problems</h1><p>Every solved problem stays in your own review history across all study lists.</p></div></section><CatalogClient key={profile.selected_catalog} initialCatalog={profile.selected_catalog} problems={problems} /></>;
}
