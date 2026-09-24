"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Clock3, ListChecks } from "lucide-react";
import type { ScheduleDay, ScheduleItem } from "@/lib/types";
import { cn, formatRelativeDue } from "@/lib/utils";

type SchedulePayload = { month: string; todayKey: string; days: ScheduleDay[] };

function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00.000Z`));
}

function compactTitle(item: ScheduleItem) {
  return item.kind === "new" ? `New · ${item.problem.title}` : item.kind.startsWith("completed") ? `Done · ${item.problem.title}` : item.problem.title;
}

export function ScheduleClient({ data }: { data: SchedulePayload }) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(data.days.some((day) => day.dateKey === data.todayKey) ? data.todayKey : data.days[0]?.dateKey ?? "");
  const [pending, startTransition] = useTransition();
  const selected = data.days.find((day) => day.dateKey === selectedDate) ?? data.days[0];
  const currentMonth = data.todayKey.slice(0, 7);
  const latestMonth = shiftMonth(currentMonth, 12);
  const earliestMonth = shiftMonth(currentMonth, -12);
  const canMoveBack = data.month > earliestMonth;
  const canMoveForward = data.month < latestMonth;
  const weeks = useMemo(() => Array.from({ length: Math.ceil(data.days.length / 7) }, (_, index) => data.days.slice(index * 7, index * 7 + 7)), [data.days]);

  function navigate(month: string) {
    startTransition(() => router.push(`/schedule?month=${month}`));
  }

  return <section className="schedule-page">
    <div className="page-heading compact-heading schedule-heading"><div><span className="eyebrow">Forecast, not a fixed promise</span><h1>Schedule</h1><p>Reviews move when you review. New-problem suggestions shift when you solve ahead.</p></div><div className="schedule-controls"><button type="button" onClick={() => navigate(shiftMonth(data.month, -1))} disabled={!canMoveBack || pending} aria-label="Previous month"><ChevronLeft size={18} /></button><button type="button" onClick={() => navigate(currentMonth)} disabled={data.month === currentMonth || pending}>Today</button><button type="button" onClick={() => navigate(shiftMonth(data.month, 1))} disabled={!canMoveForward || pending} aria-label="Next month"><ChevronRight size={18} /></button></div></div>
    <div className="schedule-layout">
      <section className={cn("schedule-calendar", pending && "is-pending")} aria-label={`${monthLabel(data.month)} schedule`}>
        <div className="schedule-month-title"><CalendarDays size={21} /><h2>{monthLabel(data.month)}</h2></div>
        <div className="weekday-row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="month-grid">{weeks.flatMap((week) => week.map((day) => {
          const inMonth = day.dateKey.startsWith(data.month);
          const counts = day.items.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {} as Record<string, number>);
          return <button type="button" className={cn("schedule-day", !inMonth && "is-outside", day.dateKey === data.todayKey && "is-today", selectedDate === day.dateKey && "is-selected")} onClick={() => setSelectedDate(day.dateKey)} key={day.dateKey} aria-pressed={selectedDate === day.dateKey}><span className="schedule-day-number">{Number(day.dateKey.slice(-2))}</span><div className="schedule-day-counts">{counts.overdue ? <i className="count-overdue">{counts.overdue} overdue</i> : null}{counts.due ? <i className="count-due">{counts.due} due</i> : null}{counts.upcoming ? <i className="count-upcoming">{counts.upcoming} planned</i> : null}{counts.completed ? <i className="count-completed">{counts.completed} done</i> : null}</div><div className="schedule-titles">{day.items.slice(0, 2).map((item, index) => <small key={`${item.kind}-${item.problem.id}-${index}`} className={`item-${item.status}`}>{compactTitle(item)}</small>)}{day.items.length > 2 && <small>+{day.items.length - 2} more</small>}</div></button>;
        }))}</div>
      </section>
      {selected && <aside className="schedule-detail"><div className="section-title"><span><ListChecks size={20} /> {new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${selected.dateKey}T12:00:00.000Z`))}</span>{selected.isStudyDay ? <span className="queue-count">Study day</span> : <span className="queue-count">Rest day</span>}</div><p className="subtle-copy">{selected.dateKey > data.todayKey ? "Future entries are forecasts and update as you study." : selected.dateKey === data.todayKey ? "Reviews are always actionable; new problems follow your target." : "Completed work is recorded here privately."}</p><div className="schedule-item-list">{selected.items.length ? selected.items.map((item, index) => <article className={`schedule-item item-${item.status}`} key={`${item.kind}-${item.problem.id}-${index}`}><span>{item.status === "completed" ? <CircleCheck size={17} /> : <Clock3 size={17} />}</span><div><strong>{item.problem.title}</strong><small>{item.kind === "new" ? `New ${item.problem.difficulty} problem` : item.status === "overdue" ? "Overdue review" : item.status === "completed" ? item.kind === "completed-new" ? "First solve completed" : "Review completed" : item.dueAt ? formatRelativeDue(item.dueAt) : "Scheduled review"}</small></div>{item.status !== "completed" && <Link href={item.kind === "new" ? `/problems/${item.problem.id}` : "/review"} aria-label={`Open ${item.problem.title}`}><ChevronRight size={17} /></Link>}</article>) : <p className="empty-copy">{selected.isStudyDay ? "No work forecast yet. Set targets in Settings to add new problems." : "No new problems on this rest day. Due reviews still appear here."}</p>}</div></aside>}
    </div>
    <section className="schedule-agenda" aria-label="Schedule agenda">{data.days.filter((day) => day.dateKey.startsWith(data.month)).map((day) => <button type="button" className={cn(day.dateKey === selectedDate && "selected")} onClick={() => setSelectedDate(day.dateKey)} key={day.dateKey}><strong>{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day.dateKey}T12:00:00.000Z`))}</strong><span>{day.items.length ? day.items.map((item) => compactTitle(item)).join(" · ") : day.isStudyDay ? "No work forecast" : "Rest day"}</span></button>)}</section>
  </section>;
}
