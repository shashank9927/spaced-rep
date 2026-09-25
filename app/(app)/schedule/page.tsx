import { ScheduleClient } from "@/components/schedule-client";
import { getScheduleAgendaData, getScheduleData } from "@/lib/queries";
import { localDateKey } from "@/lib/utils";
import { requireProfile } from "@/lib/auth";
import { RouteLoading } from "@/components/route-loading";
import { Suspense } from "react";

function currentMonth(timezone: string) {
  return localDateKey(new Date(), timezone).slice(0, 7);
}

async function ScheduleContent({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  const [profile, params] = await Promise.all([requireProfile(), searchParams]);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "") ? params.month! : currentMonth(profile.timezone);
  const maxMonth = (() => { const [year, numericMonth] = currentMonth(profile.timezone).split("-").map(Number); const value = new Date(Date.UTC(year, numericMonth + 11, 1)); return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`; })();
  const safeMonth = month > maxMonth ? maxMonth : month;
  const [agendaData, monthData] = await Promise.all([
    getScheduleAgendaData(),
    params.view === "month" ? getScheduleData(safeMonth) : Promise.resolve(null),
  ]);
  if (!agendaData) return null;
  return <ScheduleClient key={`${monthData?.month ?? "agenda"}:${agendaData.todayKey}`} agendaData={agendaData} monthData={monthData} />;
}

export default function SchedulePage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) { return <Suspense fallback={<RouteLoading />}><ScheduleContent searchParams={searchParams} /></Suspense>; }
