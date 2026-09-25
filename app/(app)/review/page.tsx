import { ReviewClient } from "@/components/review-client";
import { RouteLoading } from "@/components/route-loading";
import { getDueQueue } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";
import { Suspense } from "react";

async function ReviewContent() {
  const data = await getDueQueue();
  const optionsByProblem = Object.fromEntries(data.problems.map((problem) => [problem.id, ratingOptions(problem.card)]));
  return <ReviewClient initialQueue={data.problems} optionsByProblem={optionsByProblem} timezone={data.timezone} todayKey={data.todayKey} />;
}

export default function ReviewPage() { return <Suspense fallback={<RouteLoading variant="detail" />}><ReviewContent /></Suspense>; }
