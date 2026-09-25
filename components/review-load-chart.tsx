"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, TrendingUp } from "lucide-react";
import type { ReviewLoadPayload } from "@/lib/types";

export function ReviewLoadChart({ load }: { load: ReviewLoadPayload }) {
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const max = Math.max(4, ...load.days.map((day) => day.dueCount + day.completedCount));
  const selected = load.days.find((day) => day.dateKey === activeDay) ?? null;
  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock size={15} className="text-primary" />Review load</h2><p className="mt-0.5 text-xs text-muted-foreground">Real FSRS review dates over the next 14 local days.</p></div>
      <div className="flex flex-wrap gap-2 text-xs"><Chip tone="overdue" label={`${load.overdueCount} overdue`} /><Chip tone="today" label={`${load.totalDueNext14Days} scheduled`} />{load.peakDay && <Chip tone="peak" label={`Busiest ${load.peakDay.label} · ${load.peakDay.dueCount}`} />}</div>
    </div>
    {load.totalDueNext14Days === 0 && load.overdueCount === 0 ? <div className="grid min-h-40 place-items-center px-5 py-8 text-center text-sm text-muted-foreground">{load.nextReviewAfterWindow ? <>No reviews due in the next 14 days. Your next review is {load.nextReviewAfterWindow.label}.</> : "Record your first attempt to build your review schedule."}</div> : <>
      <div className="overflow-x-auto px-3 py-4 sm:px-5"><div className="min-w-[44rem]">
        <div className="grid h-40 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1.5 border-b border-border" aria-label="Reviews due over the next 14 days">
          {load.days.map((day) => {
            const due = day.isToday ? day.remainingTodayCount ?? day.dueCount : day.futureDueCount ?? day.dueCount;
            const total = due + day.completedCount;
            const completedHeight = `${Math.max(day.completedCount ? 4 : 0, day.completedCount / max * 100)}%`;
            const dueHeight = `${Math.max(due ? 4 : 0, due / max * 100)}%`;
            const label = `${day.fullLabel ?? day.label}: ${due} ${day.isToday ? "remaining" : "scheduled"}, ${day.completedCount} completed scheduled reviews`;
            return <button type="button" key={day.dateKey} aria-label={label} title={label} onFocus={() => setActiveDay(day.dateKey)} onBlur={() => setActiveDay(null)} onMouseEnter={() => setActiveDay(day.dateKey)} onMouseLeave={() => setActiveDay(null)} className="group relative flex h-full min-w-0 flex-col justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
              {total > 0 && <span className="mb-1 text-center font-mono text-[10px] text-muted-foreground">{total}</span>}
              {day.completedCount > 0 && <span className="w-full origin-bottom rounded-t-sm bg-emerald-500 motion-safe:animate-[chart-rise_220ms_ease-out]" style={{ height: completedHeight }} />}
              {due > 0 && <span className={`w-full origin-bottom ${day.completedCount ? "mt-px" : "rounded-t-sm"} rounded-b-sm ${day.isToday ? "bg-primary" : "bg-cyan-500"} motion-safe:animate-[chart-rise_220ms_ease-out]`} style={{ height: dueHeight }} />}
            </button>;
          })}
        </div>
        <div className="mt-2 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5">{load.days.map((day) => <span key={day.dateKey} className={`truncate text-center font-mono text-[9px] ${day.isToday ? "text-primary" : "text-muted-foreground"}`}>{day.isToday ? "Today" : day.shortLabel}</span>)}</div>
      </div></div>
      <div className="min-h-9 border-t border-border px-4 py-2 text-xs text-muted-foreground" aria-live="polite">{selected ? <><strong className="text-foreground">{selected.fullLabel ?? selected.label}</strong> · {selected.dueCount} due · {selected.completedCount} completed</> : "Focus a day for its exact review count."}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-emerald-500" />Completed</span><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-primary" />Remaining today</span><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-cyan-500" />Future due</span></div>
      <table className="sr-only"><caption>Upcoming review load</caption><thead><tr><th>Date</th><th>Due</th><th>Completed scheduled reviews</th></tr></thead><tbody>{load.days.map((day) => <tr key={day.dateKey}><td>{day.fullLabel ?? day.label}</td><td>{day.dueCount}</td><td>{day.completedCount}</td></tr>)}</tbody></table>
    </>}
  </section>;
}

function Chip({ tone, label }: { tone: "overdue" | "today" | "peak"; label: string }) {
  const style = tone === "overdue" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" : tone === "today" ? "border-primary/30 bg-primary/10 text-primary" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
  const Icon = tone === "overdue" ? AlertTriangle : tone === "peak" ? TrendingUp : undefined;
  return <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] font-semibold ${style}`}>{Icon && <Icon size={12} />}{label}</span>;
}
