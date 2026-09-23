import { AppShell } from "@/components/app-shell";
import { TodayClient } from "@/components/today-client";
import { requireProfile } from "@/lib/auth";
import { getDashboardData } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const data = await getDashboardData();
  if (!data) return null;
  const optionsByProblem = Object.fromEntries(data.due.map((problem) => [problem.id, ratingOptions(problem.card, data.now)]));
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }} streak={data.stats.currentStreak}>
    <TodayClient initialDue={data.due} upcoming={data.upcoming} patterns={data.patterns} stats={data.stats} activity={data.activity} optionsByProblem={optionsByProblem} />
  </AppShell>;
}
