import { ProgressDashboard } from "@/components/progress-dashboard";
import { RouteLoading } from "@/components/route-loading";
import { getProgressData } from "@/lib/queries";
import { Suspense } from "react";

async function ProgressContent() {
  const data = await getProgressData();
  if (!data) return null;
  return <ProgressDashboard data={data} />;
}

export default function ProgressPage() { return <Suspense fallback={<RouteLoading variant="chart" />}><ProgressContent /></Suspense>; }
