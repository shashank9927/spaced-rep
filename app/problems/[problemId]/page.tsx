import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProblemDetailClient } from "@/components/problem-detail-client";
import { requireProfile } from "@/lib/auth";
import { getProblemDetail, getProgressData } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export default async function ProblemDetailPage({ params }: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await params;
  const profile = await requireProfile();
  const [detail, progress] = await Promise.all([getProblemDetail(problemId), getProgressData()]);
  if (!detail) notFound();
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }} streak={progress?.stats.currentStreak}>
    <ProblemDetailClient problem={detail.problem} card={detail.card} logs={detail.logs} averageDuration={detail.averageDuration} timezone={profile.timezone} options={ratingOptions(detail.card?.card ?? null)} />
  </AppShell>;
}
