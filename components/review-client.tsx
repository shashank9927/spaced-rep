"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowUpRight, CheckCheck, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import { undoReview } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DueProblem, RatingOption } from "@/lib/types";
import { formatDate, localDateKey } from "@/lib/utils";

type UndoItem = { reviewLogId: string; expectedVersion: number; problem: DueProblem; position: number; expiresAt: number };
type QueueUpdate = DueProblem[] | ((queue: DueProblem[]) => DueProblem[]);

export function ReviewClient({ initialQueue, optionsByProblem, timezone, todayKey }: { initialQueue: DueProblem[]; optionsByProblem: Record<string, RatingOption[]>; timezone: string; todayKey: string }) {
  const router = useRouter();
  const [queueState, setQueueState] = useState({ dayKey: todayKey, items: initialQueue });
  const queue = queueState.dayKey === todayKey ? queueState.items : initialQueue;
  const setQueue = (update: QueueUpdate) => setQueueState((state) => {
    const base = state.dayKey === todayKey ? state.items : initialQueue;
    return { dayKey: todayKey, items: typeof update === "function" ? update(base) : update };
  });
  const [index, setIndex] = useState(0);
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(600);
  const [pending, startTransition] = useTransition();
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
    if (!undoItem) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((undoItem.expiresAt - Date.now()) / 1000));
      setUndoSeconds(seconds);
      if (seconds === 0) setUndoItem(null);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [undoItem]);

  const undo = () => {
    if (!undoItem) return;
    startTransition(async () => {
      const result = await undoReview({ reviewLogId: undoItem.reviewLogId, expectedVersion: undoItem.expectedVersion });
      if (!result.ok) { toast.error(result.error); setUndoItem(null); return; }
      if (result.card) {
        const restored: DueProblem = {
          ...undoItem.problem,
          retrievability: result.retrievabilityNow ?? 0,
          latest_rating: result.card.latestRating,
          latest_reviewed_at: result.card.last_review ?? null,
          card: { ...undoItem.problem.card, due: result.card.dueAt, due_at: result.card.dueAt, stability: result.card.stability, difficulty: result.card.difficulty, elapsed_days: result.card.elapsed_days, scheduled_days: result.card.scheduled_days, learning_steps: result.card.learning_steps, reps: result.card.reps, lapses: result.card.lapses, state: result.card.state, last_review: result.card.last_review, version: result.card.version, first_attempted_at: result.card.firstAttemptedAt },
        };
        setQueue((items) => { const position = Math.min(undoItem.position, items.length); return [...items.slice(0, position), restored, ...items.slice(position)]; });
      }
      setUndoItem(null);
      toast.success("Review undone. The card was restored to its previous position.");
    });
  };

  const undoBanner = undoItem && <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/25 bg-info-soft px-4 py-3 text-sm"><span className="text-foreground">Last review saved. You can undo it for <span className="font-mono font-semibold">{formatClock(undoSeconds)}</span>.</span><Button type="button" variant="outline" size="sm" disabled={pending} onClick={undo}>{pending ? "Undoing…" : "Undo last review"}</Button></div>;

  if (!current) return <section className="mx-auto max-w-xl">{undoBanner}<div className="grid min-h-80 place-content-center justify-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center"><CheckCheck size={34} className="text-success" /><h1 className="mt-3 text-2xl font-semibold tracking-tight">Queue clear</h1><p className="mt-2 text-sm text-muted-foreground">Nothing else is due today. Your next review will appear when its local day begins.</p><Button className="mt-5" asChild><Link href="/problems">Choose a problem</Link></Button></div></section>;

  const currentDueKey = localDateKey(new Date(current.card.due_at), timezone);
  const dueLabel = currentDueKey < currentTodayKey ? "Overdue" : "Due today";
  const hasExternalLink = Boolean(current.neetcode_url || current.leetcode_url);

  return <section className="mx-auto max-w-4xl">
    {undoBanner}
    <Link href="/today" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /> Today</Link>
    <header className="mb-4 flex items-end justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-info" />Focused session</div><h1 className="text-3xl font-semibold tracking-[-.035em]">{queue.length} review{queue.length === 1 ? "" : "s"} left</h1></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{completed} / {initialQueue.length} complete</span></header>
    <div className="mb-5 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Review session progress" aria-valuemin={0} aria-valuemax={initialQueue.length} aria-valuenow={completed}><span className="block h-full bg-primary transition-[width]" style={{ width: `${initialQueue.length ? completed / initialQueue.length * 100 : 100}%` }} /></div>

    <article className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border px-5 py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">LeetCode #{current.leetcodeNumber} · {dueLabel}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.025em]">{current.title}</h2><p className="mt-1 text-sm text-muted-foreground">{current.topics.join(" · ")}</p></div><Badge variant={current.difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{current.difficulty}</Badge></div><div className="mt-5 flex flex-wrap gap-2">{current.neetcode_url && <Button asChild><a href={current.neetcode_url} target="_blank" rel="noopener noreferrer">Open on NeetCode <ArrowUpRight size={15} /></a></Button>}{current.leetcode_url && <Button variant="outline" asChild><a href={current.leetcode_url} target="_blank" rel="noopener noreferrer">Open on LeetCode <ArrowUpRight size={15} /></a></Button>}{!hasExternalLink && <span className="flex min-h-10 items-center text-sm text-muted-foreground">External link unavailable · use the problem title or number to find it.</span>}</div></div>
      <div className="p-5"><div className="mb-5 flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground"><Lightbulb size={17} className="mt-0.5 shrink-0 text-warning" /><span>Attempt first. If you could not reconstruct the approach, study the solution, then rate what you independently recalled. A rating records learning progress, not submission acceptance.</span></div><ReviewRatingForm problemId={current.id} options={optionsByProblem[current.id]} onComplete={(result) => {
        const restorePosition = currentIndex;
        setQueue((items) => items.filter((item) => item.id !== current.id));
        setIndex(0);
        setUndoItem({ reviewLogId: result.reviewLogId, expectedVersion: result.card.version, problem: current, position: restorePosition, expiresAt: new Date(result.reviewedAt).getTime() + 10 * 60_000 });
        toast.success("Review saved", { description: `Next review: ${formatDate(result.nextDue, timezone)}.` });
      }} />{queue.length > 1 && <button type="button" onClick={() => setIndex((currentIndex + 1) % queue.length)} className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">Skip for now <ChevronRight size={15} /></button>}</div>
    </article>
  </section>;
}

function formatClock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
