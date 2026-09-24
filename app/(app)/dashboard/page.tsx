import { TodayClient } from "@/components/today-client";
import { getTodayData } from "@/lib/queries";
import { ratingOptions } from "@/lib/scheduler";

export default async function DashboardPage() {
  const data = await getTodayData();
  if (!data) return null;
  const optionsByProblem = Object.fromEntries(data.due.map((problem) => [problem.id, ratingOptions(problem.card, data.now)]));
  return <TodayClient initialDue={data.due} upcoming={data.upcoming} stats={data.stats} plan={data.todayPlan} optionsByProblem={optionsByProblem} />;
}
