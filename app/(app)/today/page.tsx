import { TodayClient } from "@/components/today-client";
import { RouteLoading } from "@/components/route-loading";
import { getTodayData } from "@/lib/queries";
import { Suspense } from "react";

async function TodayContent() {
  const data = await getTodayData();
  if (!data) return null;
  return <TodayClient initialDue={data.dueReviews} upcoming={data.upcomingReviews} stats={data} timezone={data.timezone} todayKey={data.todayKey} />;
}

export default function TodayPage() { return <Suspense fallback={<RouteLoading />}><TodayContent /></Suspense>; }
