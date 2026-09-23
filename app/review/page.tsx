import { AppShell } from "@/components/app-shell";
import { ReviewClient } from "@/components/review-client";
import { requireProfile } from "@/lib/auth";
import { getDueQueue } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const profile = await requireProfile();
  const queue = await getDueQueue();
  const optionsByProblem = Object.fromEntries(queue.map((problem) => [problem.id, ratingOptions(problem.card)]));
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }}><ReviewClient initialQueue={queue} optionsByProblem={optionsByProblem} /></AppShell>;
}
