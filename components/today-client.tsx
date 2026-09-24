"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Flame, Play, Settings2 } from "lucide-react";
import type { StudyCard } from "@/lib/analytics";
import type { DailyTarget } from "@/lib/study-plan";
import type { StudyPlanPreferences } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeDue } from "@/lib/utils";

type Stats = { reviewsThisWeek: number; currentStreak: number };

function DifficultyBadge({ difficulty }: { difficulty: "Easy" | "Medium" | "Hard" }) { return <Badge variant={difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{difficulty}</Badge>; }

export function TodayClient({ initialDue, upcoming, stats, plan }: { initialDue: StudyCard[]; upcoming: StudyCard[]; stats: Stats; plan: { preferences: StudyPlanPreferences; targets: DailyTarget[] } }) {
  const router = useRouter();
  const totalTarget = plan.preferences.easyPerDay + plan.preferences.mediumPerDay + plan.preferences.hardPerDay;
  const completed = plan.targets.reduce((sum, target) => sum + Math.min(target.completed, target.target), 0);
  const planned = plan.targets.flatMap((target) => target.problems.map((problem) => ({ problem, target })));
  const preview = upcoming.slice(0, 3);

  useEffect(() => {
    if (!initialDue.length) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']") || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "r") { event.preventDefault(); router.push("/review"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [initialDue.length, router]);

  return <div className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-cyan-500" />Daily queue</div><h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Today</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Finish reviews first, then work through the new problems in your plan.</p></div>{initialDue.length ? <Button asChild><Link href="/review"><Play size={15} /> Start reviews <kbd className="ml-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-[9px]">R</kbd></Link></Button> : <Badge variant="muted">Queue clear</Badge>}</header>

    <section className="mb-5 grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3"><Signal label="Reviews due" value={String(initialDue.length)} detail={initialDue.length ? "Complete before new work" : "Nothing waiting"} tone={initialDue.length ? "due" : "success"} /><Signal label="New today" value={plan.preferences.configured ? `${completed}/${totalTarget}` : "—"} detail={plan.preferences.configured ? totalTarget ? "Daily target progress" : "New work is paused" : "Plan not configured"} /><Signal label="Consistency" value={`${stats.currentStreak}d`} detail={`${stats.reviewsThisWeek} review${stats.reviewsThisWeek === 1 ? "" : "s"} this week`} tone="accent" /></section>

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
      <div className="space-y-5"><section className="overflow-hidden rounded-lg border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">Due reviews</h2><p className="mt-0.5 text-xs text-muted-foreground">Ordered by what is most at risk of being forgotten.</p></div>{initialDue.length > 0 && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">FSRS priority</span>}</div>{initialDue.length ? <div className="divide-y divide-border">{initialDue.map((problem) => <Link href={`/problems/${problem.id}`} className="group grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent sm:grid-cols-[3.25rem_minmax(0,1fr)_5rem_5.5rem_1rem]" key={problem.id}><span className="font-mono text-xs text-muted-foreground">#{problem.leetcodeNumber}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{problem.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{problem.topics[0] ?? "Problem"}{problem.latest_rating ? ` · last: ${problem.latest_rating === "again" ? "Forgot" : problem.latest_rating}` : ""}</span></span><span className="hidden sm:block"><DifficultyBadge difficulty={problem.difficulty} /></span><span className="hidden text-right sm:block"><span className="block text-xs font-medium text-rose-600 dark:text-rose-300">{formatRelativeDue(problem.card.due_at)}</span><span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">{Math.round(problem.retrievability * 100)}% est.</span></span><ChevronRight size={15} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>)}</div> : <div className="flex min-h-28 items-center gap-3 px-4 text-sm text-muted-foreground"><CheckCircle2 className="text-emerald-500" size={19} /> You’re caught up. The next review will appear automatically.</div>}</section>

      <section className="overflow-hidden rounded-lg border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">New today</h2><p className="mt-0.5 text-xs text-muted-foreground">Suggestions follow your catalog order and selected difficulty targets.</p></div>{plan.preferences.configured && <div className="flex gap-1.5 text-xs">{plan.targets.map((target) => <span className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground" key={target.difficulty}>{target.difficulty[0]} {Math.min(target.completed, target.target)}/{target.target}</span>)}</div>}</div>{!plan.preferences.configured ? <div className="flex flex-wrap items-center gap-4 px-4 py-5"><Settings2 size={18} className="text-muted-foreground" /><p className="flex-1 text-sm text-muted-foreground">Choose how many new Easy, Medium, and Hard problems you want on active study days.</p><Button asChild variant="outline"><Link href="/settings">Set up plan</Link></Button></div> : totalTarget === 0 ? <div className="flex flex-wrap items-center gap-4 px-4 py-5"><p className="flex-1 text-sm text-muted-foreground">New problems are paused. Reviews still appear whenever they are due.</p><Button asChild variant="outline"><Link href="/settings">Edit plan</Link></Button></div> : planned.length ? <div className="divide-y divide-border">{planned.map(({ problem, target }) => <Link href={`/problems/${problem.id}`} className="group grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent sm:grid-cols-[3.25rem_minmax(0,1fr)_5rem_1rem]" key={problem.id}><span className="font-mono text-xs text-muted-foreground">#{problem.leetcodeNumber}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{problem.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">New {target.difficulty} · {problem.topics[0] ?? "Problem"}</span></span><span className="hidden sm:block"><DifficultyBadge difficulty={problem.difficulty} /></span><ArrowRight size={15} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>)}</div> : <div className="px-4 py-5 text-sm text-muted-foreground">Today’s target is complete, or this catalog has no unused problems in the requested difficulty.</div>}</section></div>

      <aside className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Coming up</h2><p className="mt-0.5 text-xs text-muted-foreground">Your next scheduled reviews.</p></div>{preview.length ? <div className="divide-y divide-border">{preview.map((problem) => <Link href={`/problems/${problem.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent" key={problem.id}><CalendarDays size={15} className="shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">#{problem.leetcodeNumber} {problem.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatRelativeDue(problem.card.due_at)}</span></span><ChevronRight size={14} className="text-muted-foreground" /></Link>)}</div> : <p className="px-4 py-6 text-sm text-muted-foreground">Future reviews appear after your first solve.</p>}<Link href="/schedule" className="flex min-h-11 items-center justify-between border-t border-border px-4 text-xs font-medium text-primary hover:bg-accent"><span>Open 14-day schedule</span><ArrowRight size={14} /></Link></aside>
    </div>
  </div>;
}

function Signal({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "due" | "success" | "accent" }) {
  return <div className="border-b border-border p-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div className="flex items-center justify-between"><span className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">{label}</span><span className={`size-1.5 rounded-full ${tone === "due" ? "bg-rose-500" : tone === "success" ? "bg-emerald-500" : tone === "accent" ? "bg-cyan-500" : "bg-primary"}`} /></div><div className="mt-2 flex items-baseline gap-2"><strong className="text-2xl font-semibold tracking-tight">{value}</strong><span className="text-xs text-muted-foreground">{detail}</span></div></div>;
}
