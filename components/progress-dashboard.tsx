"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, BookOpenCheck, CalendarCheck2, CheckCircle2, CircleAlert, Gauge } from "lucide-react";
import type { getProgressData } from "@/lib/queries";
import type { ActivityDay, AttentionProblem, PatternSignal } from "@/lib/types";
import { activityLevel } from "@/lib/analytics";
import { cn, formatDate, localDateKey } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ProgressData = NonNullable<Awaited<ReturnType<typeof getProgressData>>>;

const ReviewLoadChart = dynamic(() => import("@/components/progress-charts").then((module) => module.ReviewLoadChart), { ssr: false, loading: () => <ChartSkeleton /> });
const ReviewOutcomesChart = dynamic(() => import("@/components/progress-charts").then((module) => module.ReviewOutcomesChart), { ssr: false, loading: () => <ChartSkeleton compact /> });

export function ProgressDashboard({ data }: { data: ProgressData }) {
  const [focusTab, setFocusTab] = useState("problems");
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const weekActivity = data.stats.firstAttemptsThisWeek + data.stats.scheduledReviewsThisWeek + data.stats.earlyReviewsThisWeek;
  const scheduledOutcomeCount = data.recallOutcomes.reduce((sum, week) => sum + week.sampleSize, 0);

  return <section className="mx-auto max-w-6xl">
    <header className="mb-6"><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-info" />Learning signals</div><h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Progress</h1><p className="mt-2 text-sm text-muted-foreground">Understand your next review work, reinforcement signals, and learning history.</p></header>

    {!data.hasCards ? <Empty icon={<BookOpenCheck size={19} />} title="Your learning history starts with one attempt." description="Choose a problem, attempt it externally, then record how well you independently recalled the approach." action={<Button asChild><Link href="/problems">Choose a problem <ArrowRight size={14} /></Link></Button>} /> : <>
      <section aria-label="At a glance" className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
        <Metric label="This week" value={`${weekActivity} ${weekActivity === 1 ? "activity" : "activities"}`} detail={`${data.stats.firstAttemptsThisWeek} first attempts · ${data.stats.scheduledReviewsThisWeek} scheduled reviews${data.stats.earlyReviewsThisWeek ? ` · ${data.stats.earlyReviewsThisWeek} early reviews` : ""} · ${data.stats.activeStudyDaysThisWeek} active ${data.stats.activeStudyDaysThisWeek === 1 ? "day" : "days"}`} icon={<Activity size={15} />} />
        <Metric label="Active problems" value={String(data.stats.activeProblemCount)} detail={data.stats.medianIntervalDays === null ? "Typical review spacing is building." : `Typical review spacing · ${formatDays(data.stats.medianIntervalDays)} median. New cards can shorten this temporarily.`} icon={<BookOpenCheck size={15} />} />
        <Metric label="Scheduled recall" value={data.stats.scheduledRecallRate === null ? "Building history" : `${Math.round(data.stats.scheduledRecallRate * 100)}%`} valueClassName={data.stats.scheduledRecallRate === null ? "text-xl" : undefined} detail={data.stats.scheduledRecallRate === null ? `${data.stats.scheduledRecallSampleSize} of 20 scheduled reviews` : `${data.stats.scheduledRecallSampleSize} scheduled reviews in the past 90 days · ${retentionContext(data.stats.scheduledRecallRate, data.scheduler.desiredRetention)}`} icon={<Gauge size={15} />} />
      </section>

      <CurrentInsight data={data} />
      <p className="mb-5 text-xs leading-5 text-muted-foreground">Scheduled recall measures successful due reviews over the last 90 days. Hard, Good, and Easy count as recalled; Forgot does not. The {Math.round(data.scheduler.desiredRetention * 100)}% target controls FSRS scheduling and is not a mastery score.</p>

      <ReviewLoadChart data={data.reviewLoad} />

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        <Tabs value={focusTab} onValueChange={setFocusTab}>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>{focusTab === "problems" ? "Review watchlist" : "Pattern overview"}</CardTitle><p className="mt-0.5 text-xs text-muted-foreground">{focusTab === "problems" ? "A review queue signal only—it does not add work or change FSRS dates." : "Schedule signals by primary pattern, not a mastery score."}</p></div>
            <TabsList aria-label="Focus view"><TabsTrigger value="problems">Problems{data.attention.length ? ` (${data.attention.length})` : ""}</TabsTrigger><TabsTrigger value="patterns">Patterns{data.patterns.length ? ` (${data.patterns.length})` : ""}</TabsTrigger></TabsList>
          </CardHeader>
          <TabsContent value="problems"><Watchlist problems={data.attention} timezone={data.timezone} todayKey={data.todayKey} /></TabsContent>
          <TabsContent value="patterns"><PatternOverview patterns={data.patterns} showAll={showAllPatterns} onShowAll={() => setShowAllPatterns((shown) => !shown)} /></TabsContent>
        </Tabs>
      </section>

      <section className="mt-8" aria-labelledby="learning-history"><div className="mb-4"><h2 id="learning-history" className="text-lg font-semibold">Learning history</h2><p className="mt-1 text-sm text-muted-foreground">Historical signals are secondary to the work that is due next.</p></div>
        {scheduledOutcomeCount > 0 && <div className="mb-5"><ReviewOutcomesChart outcomes={data.recallOutcomes} /></div>}
        <ActivityHeatmap days={data.activity} activeDays={data.activitySummary.activeDays} totalEvents={data.activitySummary.totalEvents} todayKey={data.todayKey} />
      </section>
    </>}
  </section>;
}

function CurrentInsight({ data }: { data: ProgressData }) {
  const today = data.reviewLoad.days.find((day) => day.isToday) ?? data.reviewLoad.days[0];
  const dueToday = today?.remainingTodayCount ?? today?.dueCount ?? 0;
  const upcoming = Math.max(0, data.reviewLoad.totalDueNext14Days - dueToday);

  if (data.reviewLoad.overdueCount > 0) return <Alert variant="destructive" className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><AlertTitle>{data.reviewLoad.overdueCount} overdue {data.reviewLoad.overdueCount === 1 ? "review" : "reviews"}. Start with {data.reviewLoad.overdueCount === 1 ? "it" : "them"}.</AlertTitle><AlertDescription className="text-current/80">They are already available in your review queue.</AlertDescription></div></div><Button asChild variant="destructive" size="sm"><Link href="/review">Start reviews</Link></Button></Alert>;
  if (dueToday > 0) return <Alert variant="warning" className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><AlertTitle>{dueToday} {dueToday === 1 ? "review is" : "reviews are"} due today.</AlertTitle><AlertDescription>Complete due reviews before choosing more new problems.</AlertDescription></div></div><Button asChild size="sm"><Link href="/review">Start reviews</Link></Button></Alert>;
  if (upcoming > 0) return <Alert variant="success" className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><div><AlertTitle>You are caught up today.</AlertTitle><AlertDescription>{upcoming} {upcoming === 1 ? "review is" : "reviews are"} scheduled over the next 14 days.</AlertDescription></div></div><Button asChild variant="outline" size="sm"><Link href="/schedule">Open schedule</Link></Button></Alert>;
  if (data.reviewLoad.nextReviewAfterWindow) return <Alert variant="success" className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><div><AlertTitle>You are caught up.</AlertTitle><AlertDescription>Your next review is {data.reviewLoad.nextReviewAfterWindow.label}.</AlertDescription></div></div><Button asChild variant="outline" size="sm"><Link href="/schedule">Open schedule</Link></Button></Alert>;
  return <Alert variant="success" className="mb-4"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><div><AlertTitle>You are caught up today.</AlertTitle><AlertDescription>Your schedule will appear after your first recorded attempt.</AlertDescription></div></div></Alert>;
}

function Metric({ label, value, detail, icon, valueClassName }: { label: string; value: string; detail: string; icon: React.ReactNode; valueClassName?: string }) {
  return <div className="border-b border-border p-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</span><div className={cn("mt-2 text-2xl font-semibold leading-none", valueClassName)}>{value}</div><span className="mt-2 block text-xs leading-5 text-muted-foreground">{detail}</span></div>;
}

function Watchlist({ problems, timezone, todayKey }: { problems: AttentionProblem[]; timezone: string; todayKey: string }) {
  if (!problems.length) return <CardContent><p className="py-4 text-sm text-muted-foreground">No cards need special attention right now.</p></CardContent>;
  return <div className="divide-y divide-border">{problems.map((problem) => { const label = watchlistReason(problem, timezone, todayKey); return <Link key={problem.id} href={`/problems/${problem.id}`} className="grid min-h-16 grid-cols-[3rem_minmax(0,1fr)_auto_1rem] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[3rem_minmax(0,1fr)_auto_1rem]"><span className="font-mono text-xs text-muted-foreground">#{problem.leetcodeNumber}</span><span className="min-w-0"><strong className="block truncate text-sm font-medium">{problem.title}</strong><span className="mt-1 flex flex-wrap items-center gap-1.5"><Badge variant={label.variant}>{label.text}</Badge><small className="truncate text-xs text-muted-foreground">{problem.primaryTopic ?? problem.topics[0] ?? "Problem"}</small></span></span><span className="text-right"><span className="block font-mono text-[10px] text-muted-foreground">{problem.scheduledDays}d spacing</span><span className="block text-[10px] text-muted-foreground">Next review {formatDate(problem.dueAt, timezone)}</span></span><ArrowRight size={14} className="text-muted-foreground" /></Link>; })}</div>;
}

function PatternOverview({ patterns, showAll, onShowAll }: { patterns: PatternSignal[]; showAll: boolean; onShowAll: () => void }) {
  if (!patterns.length) return <CardContent><p className="py-4 text-sm text-muted-foreground">A pattern appears here once at least two problems in it are active.</p></CardContent>;
  const visiblePatterns = showAll ? patterns : patterns.slice(0, 6);
  return <><div className="divide-y divide-border">{visiblePatterns.map((pattern) => <Link key={pattern.name} href={`/problems?topic=${encodeURIComponent(pattern.name)}`} className="block px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><div className="flex items-center justify-between gap-3"><strong className="truncate text-sm font-medium">{pattern.name}</strong><Badge variant="muted">{pattern.activeCount} active</Badge></div><p className="mt-1 text-xs text-muted-foreground">{pattern.dueCount} due or overdue · {pattern.reinforcementCount} on watchlist · {pattern.medianIntervalDays === null ? "spacing building" : `${formatDays(pattern.medianIntervalDays)} median spacing`}</p></Link>)}</div>{patterns.length > 6 && <div className="border-t border-border px-4 py-3"><Button variant="outline" size="sm" onClick={onShowAll}>{showAll ? "Show fewer patterns" : `Show all ${patterns.length} patterns`}</Button></div>}</>;
}

function ActivityHeatmap({ days, activeDays, totalEvents, todayKey }: { days: ActivityDay[]; activeDays: number; totalEvents: number; todayKey: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const weeks = Math.ceil(days.length / 7);
  const calendarWidth = weeks * 15 - 3;
  const monthLabels = activityMonthLabels(days);
  const activeEntries = days.filter((day) => !day.isFuture && day.attempts + day.scheduled + day.early > 0);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !window.matchMedia("(max-width: 639px)").matches) return;
    const frame = window.requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
    return () => window.cancelAnimationFrame(frame);
  }, [weeks]);

  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck2 size={15} className="text-success" />Study activity</h3><p className="mt-0.5 text-xs text-muted-foreground">First attempts, scheduled reviews, and early reviews across the last 52 calendar weeks.</p></div><span className="font-mono text-[10px] text-muted-foreground">{activeDays} active {activeDays === 1 ? "day" : "days"} · {totalEvents} events</span></div>
    {totalEvents === 0 ? <p className="px-4 py-7 text-sm text-muted-foreground">Recorded activity will appear here. Empty days are neutral—not missed goals.</p> : <><div ref={scrollRef} className="overflow-x-auto px-4 py-4 sm:px-5"><div className="min-w-max">
      <div className="grid grid-cols-[1.75rem_auto] gap-x-2">
        <div aria-hidden="true" />
        <div aria-hidden="true" className="activity-month-labels" style={{ width: calendarWidth }}>{monthLabels.map(({ label, week }) => <span key={`${label}-${week}`} style={{ left: week * 15 }}>{label}</span>)}</div>
        <div aria-hidden="true" className="activity-weekdays">{["Mon", "", "Wed", "", "Fri", "", ""].map((label, index) => <span key={index}>{label}</span>)}</div>
        <div role="group" aria-label="Study activity over the last fifty-two calendar weeks" className="activity-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }}>{days.map((day) => {
          const count = day.attempts + day.scheduled + day.early;
          const level = day.isFuture ? 0 : activityLevel(count);
          const label = activityLabel(day);
          const isToday = day.key === todayKey;
          const className = `activity-cell activity-level-${level} ${day.isFuture ? "activity-future" : ""} ${isToday ? "activity-today" : ""}`;
          return <div key={day.key} className="size-3">{!day.isFuture && count > 0 ? <Tooltip><TooltipTrigger asChild><button type="button" aria-label={label} className={className} /></TooltipTrigger><TooltipContent><ActivityTooltip day={day} /></TooltipContent></Tooltip> : <span aria-hidden="true" className={className} />}</div>;
        })}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-mono text-[9px] text-muted-foreground"><span>Past year · newest week at right</span><span className="flex items-center gap-1.5"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`activity-cell activity-level-${level}`} />)}<span>More</span></span></div>
    </div></div><table className="sr-only"><caption>Days with recorded study activity</caption><thead><tr><th>Date</th><th>First attempts</th><th>Scheduled reviews</th><th>Early reviews</th></tr></thead><tbody>{activeEntries.map((day) => <tr key={day.key}><td>{day.key}</td><td>{day.attempts}</td><td>{day.scheduled}</td><td>{day.early}</td></tr>)}</tbody></table></>}
  </section>;
}

function activityMonthLabels(days: ActivityDay[]) {
  const labelsByWeek = new Map<number, string>();
  days.forEach((day, index) => {
    const current = new Date(`${day.key}T12:00:00.000Z`);
    const previous = index ? new Date(`${days[index - 1]!.key}T12:00:00.000Z`) : null;
    if (!previous || current.getUTCMonth() !== previous.getUTCMonth()) labelsByWeek.set(Math.floor(index / 7), new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(current));
  });
  return Array.from(labelsByWeek, ([week, label]) => ({ week, label }));
}

function activityLabel(day: ActivityDay) {
  const date = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.key}T12:00:00.000Z`));
  return `${date}: ${day.attempts} first attempts, ${day.scheduled} scheduled reviews, ${day.early} early reviews`;
}

function ActivityTooltip({ day }: { day: ActivityDay }) {
  return <div className="space-y-1"><p className="font-medium">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.key}T12:00:00.000Z`))}</p><p>{day.attempts} first attempts · {day.scheduled} scheduled reviews · {day.early} early reviews</p></div>;
}

function ChartSkeleton({ compact = false }: { compact?: boolean }) { return <div className={cn("animate-pulse rounded-lg border border-border bg-muted", compact ? "h-56" : "h-72")} aria-label="Loading progress chart" aria-busy="true" />; }
function formatDays(days: number) { return `${Number.isInteger(days) ? days : days.toFixed(1)}d`; }
function watchlistReason(problem: AttentionProblem, timezone: string, todayKey: string): { text: string; variant: "due" | "hard" | "medium" } {
  if (problem.reason === "due") return localDateKey(new Date(problem.dueAt), timezone) < todayKey ? { text: "Overdue", variant: "due" } : { text: "Due today", variant: "medium" };
  if (problem.reason === "forgot") return { text: "Latest Forgot", variant: "due" };
  if (problem.reason === "hard") return { text: "Latest Hard", variant: "medium" };
  return { text: "Repeated lapses", variant: "hard" };
}
function retentionContext(rate: number, target: number) {
  const targetPercent = Math.round(target * 100);
  const gap = Math.round(Math.abs(rate - target) * 100);
  if (!gap) return `matches the ${targetPercent}% target`;
  return `${gap} points ${rate < target ? "below" : "above"} the ${targetPercent}% target`;
}
