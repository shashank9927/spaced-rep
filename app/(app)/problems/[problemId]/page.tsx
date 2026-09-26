import { notFound } from "next/navigation";
import { ProblemDetailClient } from "@/components/problem-detail-client";
import { requireProfile } from "@/lib/auth";
import { getProblemDetail } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

async function ProblemDetailContent({ params }: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await params;
  const [profile, detail] = await Promise.all([requireProfile(), getProblemDetail(problemId)]);
  if (!detail) notFound();
  return <ProblemDetailClient problem={detail.problem} card={detail.card} logs={detail.logs} nextCursor={detail.nextCursor} timezone={profile.timezone} options={ratingOptions(detail.card?.card ?? null)} />;
}

export default function ProblemDetailPage({ params }: { params: Promise<{ problemId: string }> }) { return <Suspense fallback={<Skeleton className="h-80" />}><ProblemDetailContent params={params} /></Suspense>; }
