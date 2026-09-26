"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Activity, ArrowRight, BookOpenCheck, CalendarCheck2, Gauge, ShieldAlert } from "lucide-react";
import type { getProgressData } from "@/lib/queries";
import type { ActivityDay } from "@/lib/types";
import { activityLevel } from "@/lib/analytics";
import { formatDate, localDateKey } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ProgressData = NonNullable<Awaited<ReturnType<typeof getProgressData>>>;
const ProgressCharts = dynamic(() => import("@/components/progress-charts").then((module) => module.ProgressCharts), { ssr: false, loading: () => <ChartSkeleton /> });

export function ProgressDashboard({ data }: { data: ProgressData }) {
  const weekActivity = data.stats.firstAttemptsThisWeek + data.stats.completedReviewsThisWeek + data.stats.earlyReviewsThisWeek;
  const recallDetail = data.stats.scheduledRecallRate === null
    ? `Past 90 local days · building sample · ${data.stats.scheduledRecallSampleSize} of 20 scheduled reviews`
    : `${data.stats.scheduledRecallSampleSize} scheduled reviews in past 90 local days · ${retentionContext(data.stats.scheduledRecallRate, data.scheduler.desiredRetention)}`;

  return <section className="mx-auto max-w-6xl">
    <header className="mb-6"><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-info" />Learning signals</div><h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Progress</h1><p className="mt-2 text-sm text-muted-foreground">See the real review workload, recent recall outcomes, and problems that need reinforcement.</p></header>

    {!data.hasCards && <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed border-border bg-card px-4 py-4"><div className="flex items-start gap-3"><BookOpenCheck size={18} className="mt-0.5 shrink-0 text-muted-foreground" /><div><h2 className="text-sm font-semibold">Your learning data starts with one attempt.</h2><p className="mt-1 text-sm text-muted-foreground">Choose a problem, attempt it externally, then record how well you recalled the approach.</p></div></div><Link href="/problems" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-link hover:underline">Open problem deck <ArrowRight size={14} /></Link></div>}

    <section className="mb-5 grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
      <Metric label="This week" value={String(weekActivity)} detail={`Mon–today · ${data.stats.firstAttemptsThisWeek} first attempts · ${data.stats.completedReviewsThisWeek} scheduled · ${data.stats.earlyReviewsThisWeek} early · ${data.stats.activeStudyDaysThisWeek} active ${data.stats.activeStudyDaysThisWeek === 1 ? "day" : "days"}`} icon={<Activity size={15} />} />
      <Metric label="Active problems" value={String(data.stats.activeProblemCount)} detail={data.stats.medianIntervalDays === null ? "Typical review spacing is building" : `Typical review spacing · median ${formatDays(data.stats.medianIntervalDays)}. New cards may shorten this temporarily.`} icon={<BookOpenCheck size={15} />} />
      <Metric label="Scheduled recall" value={data.stats.scheduledRecallRate === null ? `${data.stats.scheduledRecallSampleSize} / 20` : `${Math.round(data.stats.scheduledRecallRate * 100)}%`} detail={recallDetail} icon={<Gauge size={15} />} />
    </section>
    <p className="-mt-2 mb-5 text-xs leading-5 text-muted-foreground">Scheduled recall uses non-undone scheduled reviews from the previous 90 local calendar days: Forgot is a missed recall; Hard, Good, and Easy count as recalled. The {Math.round(data.scheduler.desiredRetention * 100)}% value is FSRS’s scheduling target, not a mastery score.</p>

    <ProgressCharts data={data} />

    <ActivityHeatmap days={data.activity} activeDays={data.activitySummary.activeDays} totalEvents={data.activitySummary.totalEvents} todayKey={data.todayKey} />

    <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <section className="overflow-hidden rounded-lg border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert size={15} /> Needs reinforcement</h2><p className="mt-0.5 text-xs text-muted-foreground">A review queue signal, not extra work. Follow the FSRS due date.</p></div><Link href="/problems" className="text-xs font-semibold text-link hover:underline">Browse problems</Link></div>{data.attention.length ? <div className="divide-y divide-border">{data.attention.map((problem) => { const dueLabel = problem.reason === "due" ? (localDateKey(new Date(problem.dueAt), data.timezone) < data.todayKey ? "Overdue" : "Due today") : reasonLabel(problem.reason); return <Link key={problem.id} href={`/problems/${problem.id}`} className="grid min-h-16 grid-cols-[3rem_minmax(0,1fr)_auto_1rem] items-center gap-3 px-4 py-3 hover:bg-accent"><span className="font-mono text-xs text-muted-foreground">#{problem.leetcodeNumber}</span><span className="min-w-0"><strong className="block truncate text-sm font-medium">{problem.title}</strong><small className="block truncate text-xs text-muted-foreground">{problem.primaryTopic ?? problem.topics[0] ?? "Problem"} · {dueLabel}</small></span><span className="text-right"><span className="block font-mono text-[10px] text-muted-foreground">{problem.scheduledDays}d spacing</span><span className="block text-[10px] text-muted-foreground">{formatDate(problem.dueAt, data.timezone)}</span></span><ArrowRight size={14} className="text-muted-foreground" /></Link>; })}</div> : <p className="px-4 py-8 text-sm text-muted-foreground">No cards need special attention right now.</p>}</section>
      <section className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Pattern signals</h2><p className="mt-0.5 text-xs text-muted-foreground">Primary patterns with at least two active problems.</p></div>{data.patterns.length ? <div className="divide-y divide-border">{data.patterns.map((pattern) => <Link key={pattern.name} href={`/problems?topic=${encodeURIComponent(pattern.name)}`} className="block px-4 py-3 hover:bg-accent"><div className="flex items-center justify-between gap-3"><strong className="truncate text-sm font-medium">{pattern.name}</strong><span className="font-mono text-[10px] text-muted-foreground">{pattern.activeCount} active</span></div><p className="mt-1 text-xs text-muted-foreground">{pattern.dueCount} due or overdue · {pattern.reinforcementCount} to reinforce · {pattern.medianIntervalDays === null ? "spacing building" : `median ${formatDays(pattern.medianIntervalDays)} spacing`}</p></Link>)}</div> : <p className="px-4 py-8 text-sm text-muted-foreground">A pattern signal appears once at least two problems in that pattern are active.</p>}</section>
    </div>
  </section>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="border-b border-border p-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</span><div className="mt-2 text-2xl font-semibold leading-none">{value}</div><span className="mt-2 block text-xs leading-5 text-muted-foreground">{detail}</span></div>;
}

function ActivityHeatmap({ days, activeDays, totalEvents, todayKey }: { days: ActivityDay[]; activeDays: number; totalEvents: number; todayKey: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const weeks = Math.ceil(days.length / 7);
  const calendarWidth = weeks * 15 - 3;
  const monthLabels = activityMonthLabels(days);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !window.matchMedia("(max-width: 639px)").matches) return;
    const frame = window.requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
    return () => window.cancelAnimationFrame(frame);
  }, [weeks]);

  return <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck2 size={15} className="text-success" />Study activity</h2><p className="mt-0.5 text-xs text-muted-foreground">First attempts, scheduled reviews, and early reviews across the last 52 calendar weeks.</p></div><span className="font-mono text-[10px] text-muted-foreground">{activeDays} active {activeDays === 1 ? "day" : "days"} · {totalEvents} events</span></div>
    {totalEvents === 0 ? <p className="px-4 py-7 text-sm text-muted-foreground">Recorded activity will appear here. Empty days are neutral—not missed goals.</p> : <div ref={scrollRef} className="overflow-x-auto px-4 py-4 sm:px-5"><div className="min-w-max">
      <div className="grid grid-cols-[1.75rem_auto] gap-x-2">
        <div aria-hidden="true" />
        <div aria-hidden="true" className="activity-month-labels" style={{ width: calendarWidth }}>{monthLabels.map(({ label, week }) => <span key={`${label}-${week}`} style={{ left: week * 15 }}>{label}</span>)}</div>
        <div aria-hidden="true" className="activity-weekdays">{["Mon", "", "Wed", "", "Fri", "", ""].map((label, index) => <span key={index}>{label}</span>)}</div>
        <div role="grid" aria-label="Study activity over the last fifty-two calendar weeks" className="activity-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }}>
          {days.map((day) => {
            const count = day.attempts + day.scheduled + day.early;
            const level = day.isFuture ? 0 : activityLevel(count);
            const label = activityLabel(day);
            const isToday = day.key === todayKey;
            return <div key={day.key} role="gridcell" aria-label={label} className="size-3">
              {day.isFuture ? <span aria-hidden="true" className="activity-cell activity-future" /> : <Tooltip><TooltipTrigger asChild><button type="button" aria-label={label} className={`activity-cell activity-level-${level} ${isToday ? "activity-today" : ""}`} /></TooltipTrigger><TooltipContent><ActivityTooltip day={day} /></TooltipContent></Tooltip>}
            </div>;
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-mono text-[9px] text-muted-foreground"><span>Past year · newest week at right</span><span className="flex items-center gap-1.5"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`activity-cell activity-level-${level}`} />)}<span>More</span></span></div>
    </div></div>}
  </section>;
}

function activityMonthLabels(days: ActivityDay[]) {
  const labelsByWeek = new Map<number, string>();
  days.forEach((day, index) => {
    const current = new Date(`${day.key}T12:00:00.000Z`);
    const previous = index ? new Date(`${days[index - 1]!.key}T12:00:00.000Z`) : null;
    if (!previous || current.getUTCMonth() !== previous.getUTCMonth()) {
      // A week can cross a month boundary. Keep the later month so labels
      // never overlap in the same column (for example Sep 29–Oct 5).
      labelsByWeek.set(Math.floor(index / 7), new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(current));
    }
  });
  return Array.from(labelsByWeek, ([week, label]) => ({ week, label }));
}

function activityLabel(day: ActivityDay) {
  const date = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.key}T12:00:00.000Z`));
  return day.isFuture ? `${date}: future day, not counted` : `${date}: ${day.attempts} first attempts, ${day.scheduled} scheduled reviews, ${day.early} early reviews`;
}

function ActivityTooltip({ day }: { day: ActivityDay }) {
  return <div className="space-y-1"><p className="font-medium">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.key}T12:00:00.000Z`))}</p><p>{day.attempts} first attempts · {day.scheduled} scheduled reviews · {day.early} early reviews</p></div>;
}

function ChartSkeleton() {
  return <div className="space-y-5" aria-label="Loading progress charts" aria-busy="true"><div className="h-72 animate-pulse rounded-lg bg-muted" /><div className="h-64 animate-pulse rounded-lg bg-muted" /></div>;
}

function formatDays(days: number) { return `${Number.isInteger(days) ? days : days.toFixed(1)}d`; }
function reasonLabel(value: "due" | "forgot" | "hard" | "repeated-lapses") { return value === "forgot" ? "latest rating: Forgot" : value === "hard" ? "latest rating: Hard" : "repeated lapses"; }
function retentionContext(rate: number, target: number) {
  const targetPercent = Math.round(target * 100);
  const gap = Math.round(Math.abs(rate - target) * 100);
  if (!gap) return `observed recall matches the ${targetPercent}% FSRS target`;
  return `observed recall is ${gap} points ${rate < target ? "below" : "above"} the ${targetPercent}% FSRS target`;
}
