"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { RecallOutcomeWeek, ReviewLoadPayload } from "@/lib/types";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

const loadConfig = {
  completed: { label: "Completed today", color: "var(--chart-completed)" },
  remaining: { label: "Remaining today", color: "var(--chart-1)" },
  future: { label: "Future due", color: "var(--chart-future)" },
};

const outcomeConfig = {
  recalled: { label: "Recalled", color: "var(--chart-completed)" },
  forgot: { label: "Forgot", color: "var(--destructive)" },
};

export function ReviewLoadChart({ data }: { data: ReviewLoadPayload }) {
  const reducedMotion = useReducedMotion();
  const load = data.days.map((day) => ({
    ...day,
    completed: day.completedReviewCount ?? day.completedCount,
    remaining: day.isToday ? day.remainingTodayCount ?? day.dueCount : 0,
    future: day.isToday ? 0 : day.futureDueCount ?? day.dueCount,
    shortLabel: day.isToday ? "Today" : day.shortLabel ?? day.label,
  }));
  const completedToday = load.reduce((sum, day) => sum + Number(day.completed), 0);
  const hasBars = data.totalDueNext14Days + completedToday > 0;
  const peakDay = data.peakDay;
  const showPeak = peakDay !== null && peakDay.dueCount >= 2;

  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <div><h2 className="text-sm font-semibold">Review load</h2><p className="mt-0.5 text-xs text-muted-foreground">Actual FSRS reviews due on each of the next 14 local days.</p></div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {data.overdueCount > 0 && <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-destructive">{data.overdueCount} overdue</span>}
        {data.totalDueNext14Days > 0 && <span className="rounded-full border border-info/30 bg-info-soft px-2.5 py-1 font-mono text-[10px] font-semibold text-info">{data.totalDueNext14Days} due in 14 days</span>}
        {showPeak && peakDay && <span className="rounded-full border border-info/30 bg-info-soft px-2.5 py-1 font-mono text-[10px] font-semibold text-info">Busiest {peakDay.label} · {peakDay.dueCount}</span>}
        <Button asChild variant="link" size="sm"><Link href="/schedule">Open schedule</Link></Button>
      </div>
    </div>
    {!hasBars ? <ReviewLoadEmpty data={data} /> : <>
      <div className="overflow-x-auto p-4 sm:px-5"><div className="h-52 min-w-[42rem]">
        <ChartContainer config={loadConfig} className="h-full">
          <BarChart data={load} accessibilityLayer margin={{ top: 12, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
            <YAxis allowDecimals={false} domain={[0, (maximum: number) => Math.max(4, maximum)]} width={30} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
            <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.45 }} content={<LoadTooltip />} />
            <ChartLegend verticalAlign="top" align="right" height={28} content={<ChartLegendContent className="justify-end" />} />
            <Bar dataKey="completed" name="Completed today" stackId="load" fill="var(--color-completed)" radius={[0, 0, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={220} />
            <Bar dataKey="remaining" name="Remaining today" stackId="load" fill="var(--color-remaining)" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={220} />
            <Bar dataKey="future" name="Future due" stackId="load" fill="var(--color-future)" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={220} />
          </BarChart>
        </ChartContainer>
      </div></div>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">Remaining reviews are shown for today; future bars show scheduled reviews. Overdue reviews stay separate.</div>
      <table className="sr-only"><caption>Review load for the next fourteen local days</caption><thead><tr><th>Date</th><th>Completed today</th><th>Remaining today</th><th>Future reviews due</th></tr></thead><tbody>{load.map((day) => <tr key={day.dateKey}><td>{day.fullLabel}</td><td>{day.completed}</td><td>{day.remaining}</td><td>{day.future}</td></tr>)}</tbody></table>
    </>}
  </section>;
}

export function ReviewOutcomesChart({ outcomes }: { outcomes: RecallOutcomeWeek[] }) {
  const reducedMotion = useReducedMotion();
  const firstEvent = outcomes.findIndex((week) => week.sampleSize > 0);
  if (firstEvent < 0) return null;

  const visibleOutcomes = outcomes.slice(Math.max(0, firstEvent - 3)).map((week) => ({ ...week, recalled: week.recalledCount, forgot: week.forgotCount }));
  const totalOutcomeEvents = visibleOutcomes.reduce((sum, week) => sum + week.sampleSize, 0);

  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"><div><h3 className="text-sm font-semibold">Scheduled review outcomes</h3><p className="mt-0.5 text-xs text-muted-foreground">Hard, Good, and Easy count as recalled. Forgot does not.</p></div><span className="font-mono text-[10px] text-muted-foreground">{totalOutcomeEvents} reviews shown</span></div>
    <div className="overflow-x-auto p-4 sm:px-5"><div className="h-48 min-w-[36rem]">
      <ChartContainer config={outcomeConfig} className="h-full">
        <BarChart data={visibleOutcomes} accessibilityLayer margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
          <YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
          <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.45 }} content={<OutcomeTooltip />} />
          <ChartLegend verticalAlign="top" align="right" height={26} content={<ChartLegendContent className="justify-end" />} />
          <Bar dataKey="recalled" name="Recalled" stackId="outcome" fill="var(--color-recalled)" radius={[0, 0, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={220} />
          <Bar dataKey="forgot" name="Forgot" stackId="outcome" fill="var(--color-forgot)" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={220} />
        </BarChart>
      </ChartContainer>
    </div></div>
    <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">Weekly percentages appear in tooltips only with at least five reviews. Scheduled Recall above is the more stable 90-day signal.</p>
    <table className="sr-only"><caption>Scheduled review outcomes by local calendar week</caption><thead><tr><th>Week beginning</th><th>Recalled</th><th>Forgot</th><th>Sample size</th><th>Recall rate</th></tr></thead><tbody>{visibleOutcomes.map((week) => <tr key={week.weekKey}><td>{week.label}</td><td>{week.recalledCount}</td><td>{week.forgotCount}</td><td>{week.sampleSize}</td><td>{week.sampleSize >= 5 && week.recallRate !== null ? `${Math.round(week.recallRate * 100)}%` : "Not emphasized: fewer than five reviews"}</td></tr>)}</tbody></table>
  </section>;
}

function ReviewLoadEmpty({ data }: { data: ReviewLoadPayload }) {
  if (data.overdueCount > 0) return <div className="grid min-h-44 place-items-center gap-3 px-5 py-8 text-center"><p className="max-w-md text-sm text-muted-foreground">Clear your overdue reviews first. No other reviews are scheduled in the next 14 days.</p><Button asChild size="sm"><Link href="/review">Start reviews</Link></Button></div>;
  if (data.nextReviewAfterWindow) return <div className="grid min-h-44 place-items-center px-5 py-8 text-center text-sm text-muted-foreground">No reviews are due in the next 14 days. Your next review is {data.nextReviewAfterWindow.label}.</div>;
  return <div className="grid min-h-44 place-items-center px-5 py-8 text-center text-sm text-muted-foreground">Record your first attempt to build your review schedule.</div>;
}

type TooltipPayload = Array<{ name?: string; value?: string | number; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }>;

function LoadTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload }) {
  if (!active || !payload?.length) return null;
  const day = payload[0]?.payload;
  if (!day) return null;
  return <ChartTooltipContent active payload={payload} label={String(day.fullLabel ?? day.label)} />;
}

function OutcomeTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload }) {
  if (!active || !payload?.length) return null;
  const week = payload[0]?.payload;
  if (!week) return null;
  const sampleSize = Number(week.sampleSize ?? 0);
  const rate = typeof week.recallRate === "number" ? `${Math.round(week.recallRate * 100)}%` : "—";
  return <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-lg"><ChartTooltipContent active payload={payload} label={`Week of ${String(week.label)}`} className="border-0 shadow-none" /><div className="flex min-w-40 justify-between gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground"><span>Sample · {sampleSize}</span>{sampleSize >= 5 && <span>Recall · {rate}</span>}</div></div>;
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reducedMotion;
}
