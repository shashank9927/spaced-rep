import { ScheduleClient } from "@/components/schedule-client";
import { getScheduleData } from "@/lib/queries";
import { localDateKey } from "@/lib/utils";
import { requireProfile } from "@/lib/auth";

function currentMonth(timezone: string) {
  return localDateKey(new Date(), timezone).slice(0, 7);
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const [profile, params] = await Promise.all([requireProfile(), searchParams]);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "") ? params.month! : currentMonth(profile.timezone);
  const maxMonth = (() => { const [year, numericMonth] = currentMonth(profile.timezone).split("-").map(Number); const value = new Date(Date.UTC(year, numericMonth + 11, 1)); return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`; })();
  const safeMonth = month > maxMonth ? maxMonth : month;
  const [data, agendaData] = await Promise.all([getScheduleData(safeMonth), getScheduleData(currentMonth(profile.timezone))]);
  if (!data || !agendaData) return null;
  return <ScheduleClient key={data.month} data={{ ...data, agendaDays: agendaData.days.slice(Math.max(0, agendaData.days.findIndex((day) => day.dateKey === agendaData.todayKey)), Math.max(0, agendaData.days.findIndex((day) => day.dateKey === agendaData.todayKey)) + 14) }} />;
}
