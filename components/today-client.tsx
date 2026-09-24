"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Play, Search } from "lucide-react";
import type { StudyCard } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeDue, localDateKey } from "@/lib/utils";

type Stats = { reviewsThisWeek: number; activeCount: number; averageRetrievability: number | null };

function DifficultyBadge({ difficulty }: { difficulty: "Easy" | "Medium" | "Hard" }) {
  return <Badge variant={difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{difficulty}</Badge>;
}

function dueLabel(dueAt: string, timezone: string) {
  const now = new Date();
  if (localDateKey(new Date(dueAt), timezone) === localDateKey(now, timezone)) return new Date(dueAt) > now ? "Due today" : "Due now";
  return formatRelativeDue(dueAt);
}

export function TodayClient({ initialDue, upcoming, stats, timezone }: { initialDue: StudyCard[]; upcoming: StudyCard[]; stats: Stats; timezone: string }) {
  const router = useRouter();
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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-cyan-500" />Manual practice</div><h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Today</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Choose new problems yourself. RecallCode only schedules them after you record an attempt.</p></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/problems"><Search size={15} /> Choose a new problem</Link></Button>{initialDue.length > 0 && <Button asChild><Link href="/review"><Play size={15} /> Start reviews <kbd className="ml-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-[9px]">R</kbd></Link></Button>}</div>
    </header>

    <section className="mb-5 grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3"><Signal label="Reviews due" value={String(initialDue.length)} detail={initialDue.length ? "Complete these first" : "Nothing waiting"} tone={initialDue.length ? "due" : "success"} /><Signal label="Reviews this week" value={String(stats.reviewsThisWeek)} detail="Attempts and reviews" /><Signal label="Active problems" value={String(stats.activeCount)} detail={stats.averageRetrievability == null ? "No memory estimate yet" : `${Math.round(stats.averageRetrievability * 100)}% estimated recall`} tone="accent" /></section>

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
      <section className="overflow-hidden rounded-lg border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">Due reviews</h2><p className="mt-0.5 text-xs text-muted-foreground">Everything due today or overdue, ordered by what is most at risk.</p></div>{initialDue.length > 0 && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">FSRS priority</span>}</div>{initialDue.length ? <div className="divide-y divide-border">{initialDue.map((problem) => <Link href={`/problems/${problem.id}`} className="group grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent sm:grid-cols-[3.25rem_minmax(0,1fr)_5rem_5.5rem_1rem]" key={problem.id}><span className="font-mono text-xs text-muted-foreground">#{problem.leetcodeNumber}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{problem.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{problem.topics[0] ?? "Problem"}{problem.latest_rating ? ` · last: ${problem.latest_rating === "again" ? "Forgot" : problem.latest_rating}` : ""}</span></span><span className="hidden sm:block"><DifficultyBadge difficulty={problem.difficulty} /></span><span className="hidden text-right sm:block"><span className="block text-xs font-medium text-rose-600 dark:text-rose-300">{dueLabel(problem.card.due_at, timezone)}</span><span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">{Math.round(problem.retrievability * 100)}% est.</span></span><ChevronRight size={15} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>)}</div> : <div className="flex min-h-32 flex-wrap items-center gap-3 px-4 py-5 text-sm text-muted-foreground"><CheckCircle2 className="text-emerald-500" size={19} /><span className="flex-1">You’re caught up. Browse the deck whenever you want a new problem.</span><Button asChild size="sm" variant="outline"><Link href="/problems">Browse problems</Link></Button></div>}</section>

      <aside className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Coming up</h2><p className="mt-0.5 text-xs text-muted-foreground">Real FSRS review dates—never assigned new work.</p></div>{preview.length ? <div className="divide-y divide-border">{preview.map((problem) => <Link href={`/problems/${problem.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent" key={problem.id}><CalendarDays size={15} className="shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">#{problem.leetcodeNumber} {problem.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatRelativeDue(problem.card.due_at)}</span></span><ChevronRight size={14} className="text-muted-foreground" /></Link>)}</div> : <p className="px-4 py-6 text-sm text-muted-foreground">Future reviews appear after you record a first attempt.</p>}<Link href="/schedule" className="flex min-h-11 items-center justify-between border-t border-border px-4 text-xs font-medium text-primary hover:bg-accent"><span>Open schedule</span><ArrowRight size={14} /></Link></aside>
    </div>
  </div>;
}

function Signal({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "due" | "success" | "accent" }) {
  return <div className="border-b border-border p-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div className="flex items-center justify-between"><span className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">{label}</span><span className={`size-1.5 rounded-full ${tone === "due" ? "bg-rose-500" : tone === "success" ? "bg-emerald-500" : tone === "accent" ? "bg-cyan-500" : "bg-primary"}`} /></div><div className="mt-2 flex items-baseline gap-2"><strong className="text-2xl font-semibold tracking-tight">{value}</strong><span className="text-xs text-muted-foreground">{detail}</span></div></div>;
}
