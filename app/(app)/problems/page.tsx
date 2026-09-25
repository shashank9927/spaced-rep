import { CatalogClient } from "@/components/catalog-client";
import { RouteLoading } from "@/components/route-loading";
import { requireProfile } from "@/lib/auth";
import { getCatalogProblems } from "@/lib/queries";
import { Suspense } from "react";

async function ProblemsContent({ searchParams }: { searchParams: Promise<{ status?: string; topic?: string }> }) {
  const [profile, params] = await Promise.all([requireProfile(), searchParams]);
  const deck = await getCatalogProblems(profile.selected_catalog);
  const initialStatus = params.status === "due" || params.status === "new" ? params.status : "all";
  const initialTopic = params.topic && deck.problems.some((problem) => problem.topics.includes(params.topic!)) ? params.topic : "all";
  return <CatalogClient key={`${profile.selected_catalog}-${initialStatus}-${initialTopic}`} initialStatus={initialStatus} initialTopic={initialTopic} problems={deck.problems} timezone={profile.timezone} catalogId={deck.catalogId} todayKey={deck.todayKey} counts={{ active: deck.activeCount, due: deck.dueCount }} />;
}

export default function ProblemsPage({ searchParams }: { searchParams: Promise<{ status?: string; topic?: string }> }) { return <Suspense fallback={<RouteLoading />}><ProblemsContent searchParams={searchParams} /></Suspense>; }
