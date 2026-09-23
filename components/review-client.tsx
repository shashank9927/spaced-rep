"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCheck, ChevronLeft, ChevronRight, Clock3, Lightbulb } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import { cn, formatRelativeDue } from "@/lib/utils";
import type { DueProblem, RatingOption } from "@/lib/types";

export function ReviewClient({ initialQueue, optionsByProblem }: { initialQueue: DueProblem[]; optionsByProblem: Record<string, RatingOption[]> }) {
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const current = queue[index];
  const completed = initialQueue.length - queue.length;
  const progress = initialQueue.length ? Math.round((completed / initialQueue.length) * 100) : 100;
  const topics = useMemo(() => current?.topics.join(" · "), [current]);
  if (!current) return <section className="review-finish"><CheckCheck size={42} /><span className="eyebrow">Queue clear</span><h1>Nothing else is due right now.</h1><p>Nice work. Your next review will surface here automatically when it is due.</p><a className="primary-button" href="/catalog">Explore the catalog</a></section>;
  function complete() {
    setQueue((items) => items.filter((item) => item.id !== current.id));
    setIndex(0);
  }
  return <section className="review-layout">
    <aside className="review-sidebar"><a href="/dashboard" className="back-link"><ChevronLeft size={16} /> Today</a><span className="eyebrow">Review session</span><h2>{queue.length} left</h2><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><p>{completed} of {initialQueue.length} completed</p><div className="rating-guide"><Lightbulb size={16} /><span>Rate the recall, not whether you got an accepted submission.</span></div></aside>
    <div className="review-card">
      <div className="review-card-top"><div><span className="due-label"><Clock3 size={15} /> {formatRelativeDue(current.card.due_at)}</span><h1>{current.title}</h1><p>{topics}</p></div><span className={`difficulty difficulty-${current.difficulty.toLowerCase()}`}>{current.difficulty}</span></div>
      <div className="review-problem-links"><a className="primary-button" href={current.neetcode_url ?? current.leetcode_url ?? "#"} target="_blank" rel="noreferrer">Open problem <ArrowUpRight size={17} /></a>{current.neetcode_url && current.leetcode_url && <a className="plain-link" href={current.leetcode_url} target="_blank" rel="noreferrer">Open in LeetCode <ArrowUpRight size={14} /></a>}</div>
      <div className="recall-prompt"><strong>Try to reconstruct the approach before opening a solution.</strong><span>Then choose the rating that best reflects what you could recall.</span></div>
      <ReviewRatingForm problemId={current.id} options={optionsByProblem[current.id]} onComplete={complete} />
      {queue.length > 1 && <div className="queue-skip"><button onClick={() => setIndex((value) => (value + 1) % queue.length)}>Skip for now <ChevronRight size={15} /></button></div>}
    </div>
  </section>;
}
