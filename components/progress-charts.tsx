"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ProgressPayload } from "@/lib/types";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type ProgressData = Pick<ProgressPayload, "reviewLoad" | "recallOutcomes">;

const loadConfig = {
  completed: { label: "Completed", color: "var(--chart-completed)" },
  remaining: { label: "Remaining today", color: "var(--chart-1)" },
  future: { label: "Future due", color: "var(--chart-future)" },
};

const outcomeConfig = {
  recalled: { label: "Recalled", color: "var(--chart-completed)" },
  forgot: { label: "Forgot", color: "var(--destructive)" },
};

export function ProgressCharts({ data }: { data: ProgressData }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const load = data.reviewLoad.days.map((day) => ({
    ...day,
    completed: day.completedReviewCount ?? day.completedCount,
    remaining: day.isToday ? day.remainingTodayCount ?? day.dueCount : 0,
    future: day.isToday ? 0 : day.futureDueCount ?? day.dueCount,
    shortLabel: day.isToday ? "Today" : day.shortLabel ?? day.label,
  }));
  const outcomes = data.recallOutcomes.map((week) => ({
    ...week,
    recalled: week.recalledCount,
    forgot: week.forgotCount,
  }));
  const totalLoad = data.reviewLoad.totalDueNext14Days + data.reviewLoad.overdueCount + data.reviewLoad.days.reduce((sum, day) => sum + day.completedCount, 0);
  const totalOutcomeEvents = data.recallOutcomes.reduce((sum, week) => sum + week.sampleSize, 0);

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div><h2 className="text-sm font-semibold">Review load</h2><p className="mt-0.5 text-xs text-muted-foreground">Actual FSRS reviews due on each of the next 14 local days.</p></div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-destructive">{data.reviewLoad.overdueCount} overdue</span>
          <span className="rounded-full border border-info/30 bg-info-soft px-2.5 py-1 font-mono text-[10px] font-semibold text-info">{data.reviewLoad.totalDueNext14Days} due in 14 days</span>
          {data.reviewLoad.peakDay && <span className="rounded-full border border-info/30 bg-info-soft px-2.5 py-1 font-mono text-[10px] font-semibold text-info">Busiest {data.reviewLoad.peakDay.label} · {data.reviewLoad.peakDay.dueCount}</span>}
        </div>
      </div>
      {totalLoad === 0 ? <div className="grid min-h-44 place-items-center px-5 py-8 text-center text-sm text-muted-foreground">{data.reviewLoad.nextReviewAfterWindow ? <>No reviews due in the next 14 days. Your next review is {data.reviewLoad.nextReviewAfterWindow.label}.</> : "Record your first attempt to build your review schedule."}</div> : <>
        <div className="overflow-x-auto p-4 sm:px-5"><div className="h-52 min-w-[42rem]">
          <ChartContainer config={loadConfig} className="h-full">
            <BarChart data={load} accessibilityLayer margin={{ top: 12, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
              <YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
              <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.45 }} content={<LoadTooltip />} />
              <ChartLegend verticalAlign="top" align="right" height={28} content={<ChartLegendContent className="justify-end" />} />
              <Bar dataKey="completed" name="Completed" stackId="load" fill="var(--color-completed)" radius={[0, 0, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={220} />
              <Bar dataKey="remaining" name="Remaining today" stackId="load" fill="var(--color-remaining)" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={220} />
              <Bar dataKey="future" name="Future due" stackId="load" fill="var(--color-future)" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={220} />
            </BarChart>
          </ChartContainer>
        </div></div>
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">The chart shows remaining reviews today and scheduled reviews on future days. Overdue reviews are counted separately.</div>
        <table className="sr-only"><caption>Review load for the next fourteen local days</caption><thead><tr><th>Date</th><th>Completed today</th><th>Remaining today</th><th>Future reviews due</th></tr></thead><tbody>{load.map((day) => <tr key={day.dateKey}><td>{day.fullLabel}</td><td>{day.completed}</td><td>{day.remaining}</td><td>{day.future}</td></tr>)}</tbody></table>
      </>}
    </section>

    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"><div><h2 className="text-sm font-semibold">Review outcomes</h2><p className="mt-0.5 text-xs text-muted-foreground">Scheduled reviews only, grouped by local calendar week. Early reviews and first attempts are excluded.</p></div><span className="font-mono text-[10px] text-muted-foreground">{totalOutcomeEvents} total</span></div>
      {totalOutcomeEvents === 0 ? <p className="grid min-h-36 place-items-center px-4 py-8 text-center text-sm text-muted-foreground">Your weekly recall outcomes will appear after your first scheduled review.</p> : <>
        <div className="overflow-x-auto p-4 sm:px-5"><div className="h-48 min-w-[36rem]">
          <ChartContainer config={outcomeConfig} className="h-full">
            <BarChart data={outcomes} accessibilityLayer margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">Weekly percentages are shown only for weeks with at least five scheduled reviews. The 90-day sample above is the more stable signal.</p>
        <table className="sr-only"><caption>Scheduled review outcomes by local calendar week</caption><thead><tr><th>Week beginning</th><th>Recalled</th><th>Forgot</th><th>Sample size</th><th>Recall rate</th></tr></thead><tbody>{outcomes.map((week) => <tr key={week.weekKey}><td>{week.label}</td><td>{week.recalledCount}</td><td>{week.forgotCount}</td><td>{week.sampleSize}</td><td>{week.sampleSize >= 5 && week.recallRate !== null ? `${Math.round(week.recallRate * 100)}%` : "Not emphasized: fewer than five reviews"}</td></tr>)}</tbody></table>
      </>}
    </section>
  </div>;
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
