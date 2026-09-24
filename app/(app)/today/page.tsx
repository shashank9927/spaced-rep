import { TodayClient } from "@/components/today-client";
import { getTodayData } from "@/lib/queries";

export default async function TodayPage() {
  const data = await getTodayData();
  if (!data) return null;
  return <TodayClient initialDue={data.dueReviews} upcoming={data.upcomingReviews} stats={data} timezone={data.timezone} />;
}
