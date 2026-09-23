import { AppShell } from "@/components/app-shell";
import { ReviewClient } from "@/components/review-client";
import { requireProfile } from "@/lib/auth";
import { getDueQueue, getProgressData } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const profile = await requireProfile();
  const [queue, progress] = await Promise.all([getDueQueue(), getProgressData()]);
  const optionsByProblem = Object.fromEntries(queue.map((problem) => [problem.id, ratingOptions(problem.card)]));
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }} streak={progress?.stats.currentStreak}><ReviewClient initialQueue={queue} optionsByProblem={optionsByProblem} /></AppShell>;
}
