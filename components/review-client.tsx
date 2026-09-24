"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, CheckCheck, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DueProblem, RatingOption } from "@/lib/types";
import { formatRelativeDue } from "@/lib/utils";

export function ReviewClient({ initialQueue, optionsByProblem }: { initialQueue: DueProblem[]; optionsByProblem: Record<string, RatingOption[]> }) {
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const current = queue[index];
  const completed = initialQueue.length - queue.length;

  if (!current) return <section className="mx-auto grid min-h-80 max-w-xl place-content-center justify-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center"><CheckCheck size={34} className="text-emerald-500" /><h1 className="mt-3 text-2xl font-semibold tracking-tight">Queue clear</h1><p className="mt-2 text-sm text-muted-foreground">Nothing else is due right now. Your next review will surface automatically.</p><Button className="mt-5" asChild><Link href="/problems">Explore problems</Link></Button></section>;

  return <section className="mx-auto max-w-4xl">
    <Link href="/today" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /> Today</Link>
    <header className="mb-4 flex items-end justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-cyan-500" />Focused session</div><h1 className="text-3xl font-semibold tracking-[-.035em]">{queue.length} review{queue.length === 1 ? "" : "s"} left</h1></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{completed} / {initialQueue.length} complete</span></header>
    <div className="mb-5 h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary transition-[width]" style={{ width: `${initialQueue.length ? completed / initialQueue.length * 100 : 100}%` }} /></div>

    <article className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border px-5 py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">LeetCode #{current.leetcodeNumber} · {formatRelativeDue(current.card.due_at)}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.025em]">{current.title}</h2><p className="mt-1 text-sm text-muted-foreground">{current.topics.join(" · ")}</p></div><Badge variant={current.difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{current.difficulty}</Badge></div><div className="mt-5 flex flex-wrap gap-2"><Button asChild><a href={current.neetcode_url ?? current.leetcode_url ?? "#"} target="_blank" rel="noopener noreferrer">Open problem <ArrowUpRight size={15} /></a></Button>{current.leetcode_url && <Button variant="outline" asChild><a href={current.leetcode_url} target="_blank" rel="noopener noreferrer">LeetCode</a></Button>}</div></div>
      <div className="p-5"><div className="mb-5 flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground"><Lightbulb size={17} className="mt-0.5 shrink-0 text-amber-500" /> Rate what you could reconstruct before opening a solution—not whether the submission was accepted.</div><ReviewRatingForm problemId={current.id} options={optionsByProblem[current.id]} onComplete={(result) => { toast.success("Review saved", { description: `Next review in ${result.newIntervalDays} day${result.newIntervalDays === 1 ? "" : "s"}.` }); setQueue((items) => items.filter((item) => item.id !== current.id)); setIndex(0); }} />{queue.length > 1 && <button type="button" onClick={() => setIndex((value) => (value + 1) % queue.length)} className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">Skip for now <ChevronRight size={15} /></button>}</div>
    </article>
  </section>;
}
