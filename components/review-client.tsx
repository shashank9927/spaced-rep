"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, CheckCheck, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DueProblem, PendingReviewUndo, RatingOption } from "@/lib/types";
import { formatDate, localDateKey } from "@/lib/utils";
import { useReviewUndo } from "@/components/review-undo-provider";
import type { UndoReviewResult } from "@/lib/actions";
import { reviewUndoExpiresAt } from "@/lib/review-undo";

type QueueUpdate = DueProblem[] | ((queue: DueProblem[]) => DueProblem[]);

export function ReviewClient({ initialQueue, optionsByProblem, timezone, todayKey }: { initialQueue: DueProblem[]; optionsByProblem: Record<string, RatingOption[]>; timezone: string; todayKey: string }) {
  const router = useRouter();
  const { registerUndo } = useReviewUndo();
  const [queueState, setQueueState] = useState({ dayKey: todayKey, items: initialQueue });
  const queue = queueState.dayKey === todayKey ? queueState.items : initialQueue;
  const setQueue = useCallback((update: QueueUpdate) => setQueueState((state) => {
    const base = state.dayKey === todayKey ? state.items : initialQueue;
    return { dayKey: todayKey, items: typeof update === "function" ? update(base) : update };
  }), [initialQueue, todayKey]);
  const [index, setIndex] = useState(0);
  const currentIndex = queue.length ? Math.min(index, queue.length - 1) : 0;
  const current = queue[currentIndex];
  const completed = initialQueue.length - queue.length;
  const currentTodayKey = localDateKey(new Date(), timezone);

  useEffect(() => {
    const checkDay = () => { if (localDateKey(new Date(), timezone) !== todayKey) router.refresh(); };
    const timer = window.setInterval(checkDay, 30_000);
    document.addEventListener("visibilitychange", checkDay);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", checkDay); };
  }, [router, timezone, todayKey]);
  useEffect(() => {
    const onUndone = (event: Event) => {
      const detail = (event as CustomEvent<{ pending: PendingReviewUndo; result: UndoReviewResult }>).detail;
      if (!detail?.result.ok || !detail.pending.problem || !detail.result.card) return;
      const original = detail.pending.problem;
      const card = detail.result.card;
      const restored: DueProblem = {
        ...original,
        retrievability: detail.result.retrievabilityNow ?? 0,
        latest_rating: card.latestRating,
        latest_reviewed_at: card.last_review ?? null,
        card: { ...original.card, due: card.dueAt, due_at: card.dueAt, stability: card.stability, difficulty: card.difficulty, elapsed_days: card.elapsed_days, scheduled_days: card.scheduled_days, learning_steps: card.learning_steps, reps: card.reps, lapses: card.lapses, state: card.state, last_review: card.last_review, version: card.version, first_attempted_at: card.firstAttemptedAt },
      };
      setQueue((items) => {
        if (items.some((item) => item.id === restored.id)) return items;
        const position = Math.min(detail.pending.queuePosition ?? 0, items.length);
        return [...items.slice(0, position), restored, ...items.slice(position)];
      });
      setIndex(detail.pending.queuePosition ?? 0);
    };
    window.addEventListener("recallcode:review-undone", onUndone);
    return () => window.removeEventListener("recallcode:review-undone", onUndone);
  }, [setQueue]);

  if (!current) return <section className="mx-auto max-w-xl"><div className="grid min-h-80 place-content-center justify-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center"><CheckCheck size={34} className="text-success" /><h1 className="mt-3 text-2xl font-semibold tracking-tight">Queue clear</h1><p className="mt-2 text-sm text-muted-foreground">Nothing else is due today. Your next review will appear when its local day begins.</p><Button className="mt-5" asChild><Link href="/problems">Choose a problem</Link></Button></div></section>;

  const currentDueKey = localDateKey(new Date(current.card.due_at), timezone);
  const dueLabel = currentDueKey < currentTodayKey ? "Overdue" : "Due today";
  const hasExternalLink = Boolean(current.neetcode_url || current.leetcode_url);

  return <section className="mx-auto max-w-4xl">
    <Link href="/today" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /> Today</Link>
    <header className="mb-4 flex items-end justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-info" />Focused session</div><h1 className="text-3xl font-semibold tracking-[-.035em]">{queue.length} review{queue.length === 1 ? "" : "s"} left</h1></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{completed} / {initialQueue.length} complete</span></header>
    <div className="mb-5 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Review session progress" aria-valuemin={0} aria-valuemax={initialQueue.length} aria-valuenow={completed}><span className="block h-full bg-primary transition-[width]" style={{ width: `${initialQueue.length ? completed / initialQueue.length * 100 : 100}%` }} /></div>

    <article className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border px-5 py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">LeetCode #{current.leetcodeNumber} · {dueLabel}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.025em]">{current.title}</h2><p className="mt-1 text-sm text-muted-foreground">{current.topics.join(" · ")}</p></div><Badge variant={current.difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{current.difficulty}</Badge></div><div className="mt-5 flex flex-wrap gap-2">{current.neetcode_url && <Button asChild><a href={current.neetcode_url} target="_blank" rel="noopener noreferrer">Open on NeetCode <ArrowUpRight size={15} /></a></Button>}{current.leetcode_url && <Button variant="outline" asChild><a href={current.leetcode_url} target="_blank" rel="noopener noreferrer">Open on LeetCode <ArrowUpRight size={15} /></a></Button>}{!hasExternalLink && <span className="flex min-h-10 items-center text-sm text-muted-foreground">External link unavailable · use the problem title or number to find it.</span>}</div></div>
      <div className="p-5"><div className="mb-5 flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground"><Lightbulb size={17} className="mt-0.5 shrink-0 text-warning" /><span>Attempt first. If you could not reconstruct the approach, study the solution, then rate what you independently recalled. A rating records learning progress, not submission acceptance.</span></div><ReviewRatingForm problemId={current.id} options={optionsByProblem[current.id]} onComplete={(result) => {
        const restorePosition = currentIndex;
        setQueue((items) => items.filter((item) => item.id !== current.id));
        setIndex(0);
        registerUndo({ reviewLogId: result.reviewLogId, problemId: current.id, expectedVersion: result.card.version, problem: current, queuePosition: restorePosition, expiresAt: reviewUndoExpiresAt(result.reviewedAt) });
        toast.success("Review saved", { description: `Next review: ${formatDate(result.nextDue, timezone)}.` });
      }} />{queue.length > 1 && <button type="button" onClick={() => setIndex((currentIndex + 1) % queue.length)} className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">Skip for now <ChevronRight size={15} /></button>}</div>
    </article>
  </section>;
}
