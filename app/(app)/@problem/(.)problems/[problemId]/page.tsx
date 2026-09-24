import { notFound } from "next/navigation";
import { ProblemDetailClient } from "@/components/problem-detail-client";
import { ProblemDetailSheet } from "@/components/problem-detail-sheet";
import { requireProfile } from "@/lib/auth";
import { getProblemDetail } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";

export default async function ProblemPanel({ params }: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await params;
  const [profile, detail] = await Promise.all([requireProfile(), getProblemDetail(problemId)]);
  if (!detail) notFound();
  return <ProblemDetailSheet title={detail.problem.title}><ProblemDetailClient panel problem={detail.problem} card={detail.card} logs={detail.logs} timezone={profile.timezone} options={ratingOptions(detail.card?.card ?? null)} /></ProblemDetailSheet>;
}
