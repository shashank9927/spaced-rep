import { notFound } from "next/navigation";
import { ProblemDetailClient } from "@/components/problem-detail-client";
import { requireProfile } from "@/lib/auth";
import { getProblemDetail } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";

export default async function ProblemDetailPage({ params }: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await params;
  const [profile, detail] = await Promise.all([requireProfile(), getProblemDetail(problemId)]);
  if (!detail) notFound();
  return <ProblemDetailClient problem={detail.problem} card={detail.card} logs={detail.logs} averageDuration={detail.averageDuration} timezone={profile.timezone} options={ratingOptions(detail.card?.card ?? null)} />;
}
