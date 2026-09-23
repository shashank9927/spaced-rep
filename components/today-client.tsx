"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, ChevronRight, Clock3, Code2, ExternalLink, Flame, Lightbulb, RotateCcw, Timer } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import type { RatingOption } from "@/lib/types";
import type { StudyCard } from "@/lib/analytics";
import { formatRelativeDue } from "@/lib/utils";

type Pattern = { name: string; activeCount: number; retrievability: number };
type Stats = { averageRetrievability: number | null; reviewsThisWeek: number; strongCount: number; currentStreak: number; activeCount: number };

export function TodayClient({ initialDue, upcoming, patterns, stats, activity, optionsByProblem }: { initialDue: StudyCard[]; upcoming: StudyCard[]; patterns: Pattern[]; stats: Stats; activity: Array<{ key: string; count: number }>; optionsByProblem: Record<string, RatingOption[]> }) {
  const [queue, setQueue] = useState(initialDue);
  const [selectedId, setSelectedId] = useState(initialDue[0]?.id ?? null);
  const [recording, setRecording] = useState(false);
  const selected = useMemo(() => queue.find((problem) => problem.id === selectedId) ?? queue[0] ?? null, [queue, selectedId]);
  const queueCount = queue.length;

  function complete(problemId: string) {
    const next = queue.filter((problem) => problem.id !== problemId);
    setQueue(next);
    setSelectedId(next[0]?.id ?? null);
    setRecording(false);
  }

  return <section className="today-page">
    <div className="today-header"><div><h1>Today</h1><p>{queueCount ? `${queueCount} problem${queueCount === 1 ? "" : "s"} need review` : "You’re caught up for now"}</p></div><div className="desktop-search-hint"><span>Search problems, patterns…</span><kbd>⌘ K</kbd></div></div>
    <div className="today-layout">
      <div className="today-primary">
        {selected ? <section className="next-problem-card">
          <div className="section-title"><span><RotateCcw size={22} /> Next Problem</span><span className={isOverdue(selected.card.due_at) ? "due-status overdue" : "due-status"}>{isOverdue(selected.card.due_at) ? "Overdue" : "Due now"}</span></div>
          <div className="next-problem-main"><div className="topic-art"><Code2 size={38} /><small>{selected.topics[0] ?? "DSA"}</small></div><div className="next-problem-copy"><div className="title-line"><h2>{selected.title}</h2><a href={selected.neetcode_url ?? selected.leetcode_url ?? "#"} target="_blank" rel="noreferrer" aria-label={`Open ${selected.title}`}><ExternalLink size={18} /></a></div><div className="meta-pills"><span className={`difficulty difficulty-${selected.difficulty.toLowerCase()}`}>{selected.difficulty}</span>{selected.topics.map((topic) => <span className="topic-pill" key={topic}>{topic}</span>)}</div><p className="next-note">{selected.latest_note ? `“${selected.latest_note}”` : "Solve it from scratch, then honestly rate how well you recalled the approach."}</p></div></div>
          <div className="next-stats"><div><CalendarDays size={18} /><span>Last solved<strong>{selected.latest_reviewed_at ? formatRelativeDue(selected.latest_reviewed_at).replace("overdue", "ago") : "First review"}</strong></span></div><div><Lightbulb size={18} /><span>Last attempt<strong>{selected.latest_rating ? selected.latest_rating === "again" ? "Forgot" : selected.latest_rating[0].toUpperCase() + selected.latest_rating.slice(1) : "—"}</strong></span></div><div><RotateCcw size={18} /><span>Review number<strong>{selected.card.reps}</strong></span></div><div><BarChart3 size={18} /><span>Memory strength<strong className="memory-value">{Math.round(selected.retrievability * 100)}%</strong></span></div></div>
          <div className="next-actions"><a className="primary-button" href={selected.neetcode_url ?? selected.leetcode_url ?? "#"} target="_blank" rel="noreferrer">Solve on NeetCode <ArrowUpRight size={17} /></a><button className="outline-button" onClick={() => setRecording((value) => !value)}>{recording ? "Close review" : "Record attempt"}</button><span>Open the problem externally, then return here to record how it went.</span></div>
        </section> : <section className="caught-up-card"><CheckCircle2 size={32} /><div><h2>You’re caught up.</h2><p>Your next review is {upcoming[0] ? formatRelativeDue(upcoming[0].card.due_at) : "waiting for your first solve"}.</p></div><Link className="primary-button" href="/problems">Browse problems</Link></section>}
        <section className="queue-card"><div className="section-title"><span><Timer size={21} /> Today’s Reviews</span><span className="queue-count">{queueCount} due</span></div>{queueCount ? <div className="today-queue-table"><div className="queue-row queue-head"><span>#</span><span>Problem</span><span>Pattern</span><span>Last solved</span><span>Due</span><span /></div>{queue.map((problem, index) => <button className={problem.id === selected?.id ? "queue-row active" : "queue-row"} onClick={() => { setSelectedId(problem.id); setRecording(false); }} key={problem.id}><span>{index + 1}</span><span><strong>{problem.title}</strong><small>{problem.difficulty}</small></span><span>{problem.topics[0] ?? "—"}</span><span>{problem.latest_reviewed_at ? formatRelativeDue(problem.latest_reviewed_at).replace("overdue", "ago") : "New"}</span><span className={isOverdue(problem.card.due_at) ? "overdue-text" : "due-text"}>{isOverdue(problem.card.due_at) ? "Overdue" : "Due now"}</span><ChevronRight size={17} /></button>)}</div> : <p className="empty-queue">No reviews due. Log a first solve from the problem list whenever you finish one.</p>}</section>
      </div>
      <aside className="today-analytics">
        {recording && selected && <section className="analytics-card side-review-panel"><div className="inline-review-heading"><div><h3>How did it go?</h3><p>{selected.title}</p></div><button onClick={() => setRecording(false)} aria-label="Close review">×</button></div><ReviewRatingForm problemId={selected.id} options={optionsByProblem[selected.id] ?? []} onComplete={() => complete(selected.id)} /></section>}
        <section className="analytics-card"><div className="section-title"><span><BarChart3 size={21} /> Pattern Memory</span></div>{patterns.length ? <div className="pattern-bars">{patterns.slice(0, 8).map((pattern) => <Link href={`/patterns?topic=${encodeURIComponent(pattern.name)}`} key={pattern.name}><span>{pattern.name}</span><i><b style={{ width: `${Math.round(pattern.retrievability * 100)}%` }} /></i><strong>{Math.round(pattern.retrievability * 100)}%</strong></Link>)}</div> : <p className="empty-copy">Patterns appear after you log your first solve.</p>}</section>
        <section className="analytics-card quick-stats"><div className="section-title"><span><Clock3 size={21} /> Quick Stats</span></div><div><span><strong>{stats.averageRetrievability == null ? "—" : `${Math.round(stats.averageRetrievability * 100)}%`}</strong><small>Estimated recall</small></span><span><strong>{stats.reviewsThisWeek}</strong><small>Reviews this week</small></span><span><strong>{stats.strongCount}</strong><small>Strong problems</small></span></div></section>
        <section className="analytics-card consistency-card"><div className="section-title"><span><Flame size={21} /> Consistency</span><strong>{stats.currentStreak} days</strong></div><div className="activity-grid">{activity.map((day) => <i key={day.key} title={`${day.key}: ${day.count} reviews`} className={`activity-cell level-${Math.min(day.count, 4)}`} />)}</div></section>
      </aside>
    </div>
  </section>;
}

function isOverdue(dueAt: string) {
  return Date.now() - new Date(dueAt).getTime() > 60 * 60 * 1000;
}
