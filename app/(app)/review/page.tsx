import { ReviewClient } from "@/components/review-client";
import { getDueQueue } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";

export default async function ReviewPage() {
  const queue = await getDueQueue();
  const optionsByProblem = Object.fromEntries(queue.map((problem) => [problem.id, ratingOptions(problem.card)]));
  return <ReviewClient initialQueue={queue} optionsByProblem={optionsByProblem} />;
}
