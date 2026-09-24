"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, History, Play, RotateCcw } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudyCard } from "@/lib/analytics";
import type { ProblemSummary, RatingOption, ReviewLogSummary } from "@/lib/types";
import { formatDate, formatDateTime, formatRelativeDue } from "@/lib/utils";

type Completion = { nextDue: string; newIntervalDays: number; newRetrievability: number; updatedCard: { stability: number; lapses: number; repetitions: number; firstAttemptedAt: string } };

export function ProblemDetailClient({ problem, card, logs, timezone, options, panel = false }: { problem: ProblemSummary; card: StudyCard | null; logs: ReviewLogSummary[]; timezone: string; options: RatingOption[]; panel?: boolean }) {
  const [recording, setRecording] = useState(false);
  const [currentCard, setCurrentCard] = useState(card);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const isDue = currentCard && new Date(currentCard.card.due_at).getTime() <= now;
  const complete = (result: Completion) => {
    setCurrentCard((existing) => existing ? { ...existing, retrievability: result.newRetrievability, latest_reviewed_at: new Date().toISOString(), card: { ...existing.card, due: result.nextDue, due_at: result.nextDue, stability: result.updatedCard.stability, lapses: result.updatedCard.lapses, reps: result.updatedCard.repetitions, scheduled_days: result.newIntervalDays, last_review: new Date().toISOString(), first_attempted_at: result.updatedCard.firstAttemptedAt } } : { ...problem, retrievability: result.newRetrievability, latest_rating: null, latest_note: null, latest_reviewed_at: new Date().toISOString(), card: { due: result.nextDue, due_at: result.nextDue, stability: result.updatedCard.stability, difficulty: 0, elapsed_days: 0, scheduled_days: result.newIntervalDays, learning_steps: 0, reps: result.updatedCard.repetitions, lapses: result.updatedCard.lapses, state: 0, last_review: new Date().toISOString(), version: 1, first_attempted_at: result.updatedCard.firstAttemptedAt } });
    setRecording(false);
    setConfirmation(`Saved — next review in ${result.newIntervalDays} day${result.newIntervalDays === 1 ? "" : "s"}.`);
  };
  return <section className={panel ? "p-5" : "mx-auto max-w-3xl"}>
    {!panel && <Link href="/problems" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Problems</Link>}
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">LEETCODE #{problem.leetcodeNumber}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{problem.title}</h1><div className="mt-3 flex flex-wrap gap-1.5"><Badge variant={problem.difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{problem.difficulty}</Badge>{problem.topics.map((topic) => <Badge variant="muted" key={topic}>{topic}</Badge>)}</div></div><div className="flex shrink-0 gap-2"><Button size="sm" asChild><a href={problem.neetcode_url ?? problem.leetcode_url ?? "#"} target="_blank" rel="noreferrer">Solve <ArrowUpRight size={14} /></a></Button>{problem.leetcode_url && <Button size="sm" variant="outline" asChild><a href={problem.leetcode_url} target="_blank" rel="noreferrer">LeetCode</a></Button>}</div></div>
    {confirmation && <p role="status" className="mt-4 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{confirmation}</p>}
    <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm sm:grid-cols-3"><Fact label="Status" value={!currentCard ? "New" : isDue ? "Ready now" : formatRelativeDue(currentCard.card.due_at)} /><Fact label="Reviews" value={currentCard ? String(currentCard.card.reps) : "—"} /><Fact label="Recall estimate" value={currentCard ? `${Math.round(currentCard.retrievability * 100)}%` : "—"} /><Fact label="Interval" value={currentCard ? `${currentCard.card.scheduled_days} days` : "—"} /><Fact label="First attempt" value={currentCard ? formatDate(currentCard.card.first_attempted_at, timezone) : "—"} /><Fact label="Last result" value={currentCard?.latest_rating ? currentCard.latest_rating === "again" ? "Forgot" : currentCard.latest_rating : "—"} /></dl>
    <section className="mt-6 rounded-lg border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-4 py-3"><span className="flex items-center gap-2 text-sm font-semibold"><RotateCcw size={16} /> Your review</span>{currentCard && <span className="text-xs text-muted-foreground">{isDue ? "Due now" : "Scheduled"}</span>}</div><div className="p-4"><p className="mb-4 text-sm text-muted-foreground">{!currentCard ? "Solve it externally, then record what you could recall." : isDue ? "Try from scratch before rating your recall." : `This card is ${formatRelativeDue(currentCard.card.due_at)}. Reviewing early replaces that schedule from now.`}</p><Button variant={currentCard && !isDue ? "outline" : "default"} type="button" onClick={() => setRecording((value) => !value)}><Play size={15} /> {recording ? "Close rating" : !currentCard ? "Record attempt" : isDue ? "Record review" : "Review early"}</Button>{recording && <div className="mt-4 border-t border-border pt-4"><ReviewRatingForm problemId={problem.id} options={options} onComplete={complete} /></div>}</div></section>
    <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><History size={16} /> Review history</h2><span className="text-xs text-muted-foreground">{logs.length} entries</span></div>{logs.length ? <div className="divide-y divide-border rounded-lg border border-border bg-card">{logs.map((log) => <article className="px-4 py-3" key={log.id}><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{log.rating === "again" ? "Forgot" : log.rating[0].toUpperCase() + log.rating.slice(1)}</span><span className="text-xs text-muted-foreground">{formatDateTime(log.reviewed_at, timezone)} · next {log.scheduled_days}d</span></div>{log.note && <p className="mt-2 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">{log.note}</p>}</article>)}</div> : <p className="rounded-lg border border-dashed border-border px-4 py-7 text-sm text-muted-foreground">Your private review history will appear after the first solve.</p>}</section>
  </section>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="bg-card px-3 py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate text-sm font-medium">{value}</dd></div>; }
