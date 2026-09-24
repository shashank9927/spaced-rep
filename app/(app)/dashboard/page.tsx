import { TodayClient } from "@/components/today-client";
import { getTodayData } from "@/lib/queries";

export default async function DashboardPage() {
  const data = await getTodayData();
  if (!data) return null;
  return <TodayClient initialDue={data.due} upcoming={data.upcoming} stats={data.stats} plan={data.todayPlan} />;
}
