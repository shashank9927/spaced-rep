import { ReviewClient } from "@/components/review-client";
import { RouteLoading } from "@/components/route-loading";
import { getDueQueue } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";
import { Suspense } from "react";

async function ReviewContent({ problemId }: { problemId?: string }) {
  const data = await getDueQueue();
  const selected = problemId ? data.problems.find((problem) => problem.id === problemId) : undefined;
  const queue = selected ? [selected, ...data.problems.filter((problem) => problem.id !== selected.id)] : data.problems;
  const optionsByProblem = Object.fromEntries(queue.map((problem) => [problem.id, ratingOptions(problem.card)]));
  return <ReviewClient initialQueue={queue} optionsByProblem={optionsByProblem} timezone={data.timezone} todayKey={data.todayKey} />;
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  const params = await searchParams;
  return <Suspense fallback={<RouteLoading variant="detail" />}><ReviewContent problemId={params.problem} /></Suspense>;
}
