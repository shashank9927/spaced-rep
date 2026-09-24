import { ProgressDashboard } from "@/components/progress-dashboard";
import { getProgressData } from "@/lib/queries";

export default async function ProgressPage() {
  const data = await getProgressData();
  if (!data) return null;
  return <ProgressDashboard data={data} />;
}
