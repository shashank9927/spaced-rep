"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowUpRight, History, MoreHorizontal, Play, RotateCcw } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import { loadProblemHistory, type ReviewActionResult, type ReviewConflictFailure, type UndoReviewResult } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudyCard } from "@/lib/analytics";
import type { CompleteUserProblemCard, PendingReviewUndo, ProblemSummary, RatingOption, ReviewLogSummary } from "@/lib/types";
import { formatDate, formatDateTime, localDateKey } from "@/lib/utils";
import { useReviewUndo } from "@/components/review-undo-provider";
import { reviewUndoExpiresAt } from "@/lib/review-undo";

type Completion = Extract<ReviewActionResult, { ok: true }>;

export function ProblemDetailClient({ problem, card, logs, nextCursor: initialNextCursor, timezone, options, panel = false }: { problem: ProblemSummary; card: StudyCard | null; logs: ReviewLogSummary[]; nextCursor: string | null; timezone: string; options: RatingOption[]; panel?: boolean }) {
  const { registerUndo } = useReviewUndo();
  const [recording, setRecording] = useState(false);
  const [currentCard, setCurrentCard] = useState(card);
  const [history, setHistory] = useState(logs);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [ratingChoices, setRatingChoices] = useState(options);
  const [historyPending, startHistoryTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const todayKey = localDateKey(now, timezone);
  const dueKey = currentCard ? localDateKey(new Date(currentCard.card.due_at), timezone) : null;
  const isDue = Boolean(dueKey && dueKey <= todayKey);
  const statusLabel = !currentCard ? "New" : dueKey! < todayKey ? "Overdue" : dueKey === todayKey ? "Due today" : `Scheduled · ${formatDate(currentCard.card.due_at, timezone)}`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onUndone = (event: Event) => {
      const detail = (event as CustomEvent<{ pending: PendingReviewUndo; result: UndoReviewResult }>).detail;
      if (!detail?.result.ok || detail.pending.problemId !== problem.id) return;
      setCurrentCard(detail.result.card ? toStudyCard(problem, detail.result.card, detail.result.retrievabilityNow ?? 0, null, detail.result.card.last_review ?? null) : null);
      setRatingChoices(detail.result.ratingOptions);
      setHistory((entries) => entries.filter((entry) => entry.id !== detail.pending.reviewLogId));
      setConfirmation("Review undone. The previous schedule was restored.");
    };
    window.addEventListener("recallcode:review-undone", onUndone);
    return () => window.removeEventListener("recallcode:review-undone", onUndone);
  }, [problem]);

  const complete = (result: Completion) => {
    setCurrentCard(toStudyCard(problem, result.card, result.retrievabilityNow, result.note, result.reviewedAt));
    setRecording(false);
    setRatingChoices(result.ratingOptions);
    registerUndo({ reviewLogId: result.reviewLogId, problemId: problem.id, expectedVersion: result.card.version, expiresAt: reviewUndoExpiresAt(result.reviewedAt) });
    setHistory((entries) => [{ id: result.reviewLogId, problem_id: problem.id, rating: result.card.latestRating, reviewed_at: result.reviewedAt, note: result.note, previous_due_at: currentCard?.card.due_at ?? null, next_due_at: result.nextDue, scheduled_days: result.newIntervalDays, event_kind: result.eventKind, result_version: result.card.version }, ...entries]);
    setConfirmation(`Saved — next review in ${result.newIntervalDays} day${result.newIntervalDays === 1 ? "" : "s"}.`);
  };

  return <section className={panel ? "p-5" : "mx-auto max-w-3xl"}>
    {!panel && <Link href="/problems" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Problems</Link>}
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">LEETCODE #{problem.leetcodeNumber}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{problem.title}</h1><div className="mt-3 flex flex-wrap gap-1.5"><Badge variant={problem.difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{problem.difficulty}</Badge>{problem.topics.map((topic) => <Badge variant="muted" key={topic}>{topic}</Badge>)}</div></div><div className="flex shrink-0 flex-wrap gap-2">{problem.neetcode_url && <Button size="sm" asChild><a href={problem.neetcode_url} target="_blank" rel="noopener noreferrer">Open on NeetCode <ArrowUpRight size={14} /></a></Button>}{problem.leetcode_url && <Button size="sm" variant="outline" asChild><a href={problem.leetcode_url} target="_blank" rel="noopener noreferrer">Open on LeetCode <ArrowUpRight size={14} /></a></Button>}{!problem.neetcode_url && !problem.leetcode_url && <span className="flex min-h-9 items-center text-xs text-muted-foreground">External link unavailable</span>}</div></div>

    {confirmation && <div role="status" className="mt-4 rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">{confirmation}</div>}

    <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm sm:grid-cols-3"><Fact label="Status" value={statusLabel} /><Fact label="Recorded ratings" value={currentCard ? String(currentCard.card.reps) : "—"} /><Fact label="Forgot during review" value={currentCard ? String(currentCard.card.lapses) : "—"} help="FSRS lapse count; first-attempt Forgot ratings do not count as review lapses." /><Fact label="Current review spacing" value={currentCard ? `${currentCard.card.scheduled_days} days` : "—"} /><Fact label="First attempt" value={currentCard ? formatDate(currentCard.card.first_attempted_at, timezone) : "—"} /><Fact label="Latest result" value={currentCard?.latest_rating ? currentCard.latest_rating === "again" ? "Forgot" : currentCard.latest_rating[0].toUpperCase() + currentCard.latest_rating.slice(1) : "—"} /></dl>

    {currentCard && <details className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">FSRS memory estimate</summary><p className="mt-2 text-muted-foreground">Estimated recall now: {Math.round(currentCard.retrievability * 100)}%. This is a current probability of recall, not mastery or a recommendation to review early.</p></details>}

    <section className="mt-6 rounded-lg border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><span className="flex items-center gap-2 text-sm font-semibold"><RotateCcw size={16} /> {currentCard ? "Review" : "First attempt"}</span><div className="flex items-center gap-2">{currentCard && <span className="text-xs text-muted-foreground">{statusLabel}</span>}{currentCard && !isDue && <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button size="sm" variant="ghost"><MoreHorizontal size={15} /> More</Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-64 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl"><DropdownMenu.Item onSelect={() => setRecording(true)} className="flex min-h-10 cursor-pointer items-center rounded-md px-2 text-sm outline-none hover:bg-accent">Review early</DropdownMenu.Item><p className="px-2 pb-2 text-xs leading-5 text-muted-foreground">This replaces the current due date using the time you submit it.</p></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>}</div></div><div className="p-4"><p className="mb-4 text-sm text-muted-foreground">{!currentCard ? "Choose an external problem link, attempt it, then record your recall. If you could not solve independently, study the solution before rating Forgot." : isDue ? "This problem is due for your local calendar day. Attempt it before rating your recall." : `This card is scheduled for ${formatDate(currentCard.card.due_at, timezone)}. Reviewing early replaces that schedule.`}</p>{(!currentCard || isDue) && <Button type="button" onClick={() => setRecording((value) => !value)}><Play size={15} /> {recording ? "Close rating" : !currentCard ? "Record first attempt" : "Record review"}</Button>}{currentCard && !isDue && recording && <Button variant="outline" type="button" onClick={() => setRecording(false)}>Close rating</Button>}{recording && <div className="mt-4 border-t border-border pt-4"><ReviewRatingForm problemId={problem.id} options={ratingChoices} onConflict={(result: ReviewConflictFailure) => {
      setCurrentCard(toStudyCard(problem, result.latestCard, result.retrievabilityNow, null, result.latestCard.last_review ?? null));
      setRatingChoices(result.ratingOptions);
      setConfirmation("This problem changed in another tab. The latest schedule is loaded; rate again only if you still intend to review it now.");
    }} onComplete={complete} /></div>}</div></section>

    <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><History size={16} /> Rating history</h2><span className="text-xs text-muted-foreground">{history.length} loaded</span></div>{history.length ? <div className="divide-y divide-border rounded-lg border border-border bg-card">{history.map((log) => <article className="px-4 py-3" key={log.id}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{eventLabel(log.event_kind)} · {log.rating === "again" ? "Forgot" : log.rating[0].toUpperCase() + log.rating.slice(1)}</span><span className="text-xs text-muted-foreground">{formatDateTime(log.reviewed_at, timezone)} · next spacing {log.scheduled_days}d</span></div>{log.note && <p className="mt-2 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">{log.note}</p>}</article>)}{nextCursor && <div className="p-3 text-center"><Button variant="ghost" type="button" disabled={historyPending} onClick={() => startHistoryTransition(async () => { const result = await loadProblemHistory({ problemId: problem.id, before: nextCursor }); if (!result.ok) { setConfirmation(result.error); return; } setHistory((entries) => [...entries, ...result.entries.filter((entry) => !entries.some((existing) => existing.id === entry.id))]); setNextCursor(result.nextCursor); })}>{historyPending ? "Loading…" : "Load older"}</Button></div>}</div> : <p className="rounded-lg border border-dashed border-border px-4 py-7 text-sm text-muted-foreground">Private rating history appears after your first recorded attempt.</p>}</section>
  </section>;
}

function toStudyCard(problem: ProblemSummary, card: CompleteUserProblemCard, recall: number, note: string | null, reviewedAt: string | null): StudyCard {
  return { ...problem, retrievability: recall, latest_rating: card.latestRating, latest_note: note, latest_reviewed_at: reviewedAt, card: { due: card.dueAt, due_at: card.dueAt, stability: card.stability, difficulty: card.difficulty, elapsed_days: card.elapsed_days, scheduled_days: card.scheduled_days, learning_steps: card.learning_steps, reps: card.reps, lapses: card.lapses, state: card.state, last_review: card.last_review, version: card.version, first_attempted_at: card.firstAttemptedAt } };
}

function Fact({ label, value, help }: { label: string; value: string; help?: string }) { return <div className="bg-card px-3 py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate text-sm font-medium" title={help}>{value}</dd>{help && <dd className="sr-only">{help}</dd>}</div>; }
function eventLabel(kind?: ReviewLogSummary["event_kind"]) { return kind === "first_attempt" ? "First attempt" : kind === "early_review" ? "Early review" : "Scheduled review"; }
