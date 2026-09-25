import { ReviewClient } from "@/components/review-client";
import { RouteLoading } from "@/components/route-loading";
import { getDueQueue } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";
import { Suspense } from "react";

async function ReviewContent() {
  const queue = await getDueQueue();
  const optionsByProblem = Object.fromEntries(queue.map((problem) => [problem.id, ratingOptions(problem.card)]));
  return <ReviewClient initialQueue={queue} optionsByProblem={optionsByProblem} />;
}

export default function ReviewPage() { return <Suspense fallback={<RouteLoading variant="detail" />}><ReviewContent /></Suspense>; }
