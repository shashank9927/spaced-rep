"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReviewLoadPayload } from "@/lib/types";

export function ReviewLoadChart({ load }: { load: ReviewLoadPayload }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update);
  }, []);
  const max = Math.max(4, ...load.days.map((day) => Math.max(day.dueCount, day.completedCount)));
  const rows = load.days.map((day) => ({
    ...day,
    remaining: day.isToday ? day.remainingTodayCount ?? day.dueCount : 0,
    future: day.isToday ? 0 : day.futureDueCount ?? day.dueCount,
  }));
  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock size={15} className="text-primary" />Review load</h2><p className="mt-0.5 text-xs text-muted-foreground">Real FSRS review dates over the next 14 local days.</p></div>
      <div className="flex flex-wrap gap-2 text-xs"><Chip tone="overdue" label={load.overdueCount + " overdue"} /><Chip tone="today" label={load.totalDueNext14Days + " scheduled"} />{load.peakDay && <Chip tone="peak" label={"Busiest " + load.peakDay.label + " · " + load.peakDay.dueCount} />}</div>
    </div>
    {load.totalDueNext14Days === 0 && load.overdueCount === 0 ? <div className="grid min-h-40 place-items-center px-5 py-8 text-center text-sm text-muted-foreground">Record your first attempt to build your review schedule.</div> : <><div className="overflow-x-auto px-3 py-4 sm:px-5"><div className="h-40 min-w-[44rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 17, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 5" />
          <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }} />
          <YAxis allowDecimals={false} domain={[0, max]} width={28} axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
          <Tooltip cursor={{ fill: "var(--accent)" }} content={<ReviewLoadTooltip />} />
          <Bar dataKey="completedCount" stackId="work" fill="var(--chart-completed)" radius={[3, 3, 0, 0]} isAnimationActive={!reduceMotion} animationDuration={220} name="Completed scheduled"><LabelList dataKey="completedCount" position="top" formatter={(value) => Number(value) || ""} fill="var(--muted-foreground)" fontSize={10} /></Bar>
          <Bar dataKey="remaining" stackId="work" fill="var(--primary)" radius={[3, 3, 0, 0]} isAnimationActive={!reduceMotion} animationDuration={220} name="Remaining today"><Cell fill="var(--primary)" /></Bar>
          <Bar dataKey="future" stackId="work" fill="var(--chart-future)" radius={[3, 3, 0, 0]} isAnimationActive={!reduceMotion} animationDuration={220} name="Future due" />
        </BarChart>
      </ResponsiveContainer>
    </div></div><div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-emerald-500" />Completed</span><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-primary" />Remaining today</span><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-cyan-500" />Future due</span></div>
      <table className="sr-only"><caption>Upcoming review load</caption><thead><tr><th>Date</th><th>Due</th><th>Completed scheduled reviews</th></tr></thead><tbody>{rows.map((day) => <tr key={day.dateKey}><td>{day.fullLabel}</td><td>{day.dueCount}</td><td>{day.completedCount}</td></tr>)}</tbody></table></>}
  </section>;
}

function ReviewLoadTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const day = payload[0].payload;
  return <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl"><strong className="block">{day.fullLabel}</strong><span className="mt-1 block text-muted-foreground">{day.dueCount} due · {day.completedCount} completed</span></div>;
}
function Chip({ tone, label }: { tone: "overdue" | "today" | "peak"; label: string }) {
  const style = tone === "overdue" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" : tone === "today" ? "border-primary/30 bg-primary/10 text-primary" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
  const Icon = tone === "overdue" ? AlertTriangle : tone === "peak" ? TrendingUp : undefined;
  return <span className={"inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] font-semibold " + style}>{Icon && <Icon size={12} />}{label}</span>;
}
