import { CatalogClient } from "@/components/catalog-client";
import { requireProfile } from "@/lib/auth";
import { getCatalogProblems } from "@/lib/queries";

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<{ status?: string; topic?: string }> }) {
  const [profile, params] = await Promise.all([requireProfile(), searchParams]);
  const problems = await getCatalogProblems(profile.selected_catalog);
  const initialStatus = params.status === "due" || params.status === "new" ? params.status : "all";
  const initialTopic = params.topic && problems.some((problem) => problem.topics.includes(params.topic!)) ? params.topic : "all";
  return <CatalogClient key={`${profile.selected_catalog}-${initialStatus}-${initialTopic}`} initialStatus={initialStatus} initialTopic={initialTopic} problems={problems} />;
}
