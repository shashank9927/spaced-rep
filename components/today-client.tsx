"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, ChevronRight, Clock3, Lightbulb, RotateCcw, Settings2, Timer } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import { ratingOptions } from "@/lib/scheduler";
import type { DailyTarget } from "@/lib/study-plan";
import type { RatingOption } from "@/lib/types";
import type { StudyCard } from "@/lib/analytics";
import type { ProblemSummary, StudyPlanPreferences } from "@/lib/types";
import { formatRelativeDue } from "@/lib/utils";

type Stats = { averageRetrievability: number | null; reviewsThisWeek: number; strongCount: number; currentStreak: number };

export function TodayClient({ initialDue, upcoming, stats, optionsByProblem, plan }: { initialDue: StudyCard[]; upcoming: StudyCard[]; stats: Stats; optionsByProblem: Record<string, RatingOption[]>; plan: { preferences: StudyPlanPreferences; targets: DailyTarget[] } }) {
  const [queue, setQueue] = useState(initialDue);
  const [selectedId, setSelectedId] = useState(initialDue[0]?.id ?? null);
  const [recordingReview, setRecordingReview] = useState(false);
  const [targets, setTargets] = useState(plan.targets);
  const [selectedNew, setSelectedNew] = useState<ProblemSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const selected = useMemo(() => queue.find((problem) => problem.id === selectedId) ?? queue[0] ?? null, [queue, selectedId]);
  const queueCount = queue.length;
  const totalTarget = plan.preferences.easyPerDay + plan.preferences.mediumPerDay + plan.preferences.hardPerDay;

  function completeReview(problemId: string, interval: number) {
    const next = queue.filter((problem) => problem.id !== problemId);
    setQueue(next);
    setSelectedId(next[0]?.id ?? null);
    setRecordingReview(false);
    setToast(`Saved — next review in ${interval} day${interval === 1 ? "" : "s"}.`);
  }

  function completeFirstSolve(problem: ProblemSummary, interval: number) {
    setTargets((current) => current.map((target) => target.difficulty === problem.difficulty ? {
      ...target,
      completed: target.completed + 1,
      remaining: Math.max(0, target.remaining - 1),
      problems: target.problems.filter((item) => item.id !== problem.id),
    } : target));
    setSelectedNew(null);
    setToast(`${problem.title} added — next review in ${interval} day${interval === 1 ? "" : "s"}.`);
  }

  return <section className="today-page">
    <div className="today-header"><div><h1>Today</h1><p>{queueCount ? `${queueCount} due review${queueCount === 1 ? "" : "s"} — finish these first.` : "No reviews due right now."}</p></div><div className="today-metrics"><span><strong>{stats.currentStreak}</strong> day streak</span><span><strong>{stats.reviewsThisWeek}</strong> reviews this week</span></div></div>
    {toast && <div className="app-toast" role="status"><CheckCircle2 size={17} />{toast}<button onClick={() => setToast(null)} aria-label="Dismiss confirmation">×</button></div>}
    <div className="today-layout productivity-layout">
      <div className="today-primary">
        <section className="daily-section due-section"><div className="section-title"><span><RotateCcw size={21} /> Due reviews</span><span className="queue-count">{queueCount} uncapped</span></div>
          {selected ? <section className="next-problem-card">
            <div className="section-title"><span><Timer size={19} /> Next review</span><span className={isOverdue(selected.card.due_at) ? "due-status overdue" : "due-status"}>{isOverdue(selected.card.due_at) ? "Overdue" : "Due now"}</span></div>
            <div className="next-problem-main"><div className="topic-art"><Lightbulb size={34} /><small>{selected.topics[0] ?? "DSA"}</small></div><div className="next-problem-copy"><div className="title-line"><h2>{selected.title}</h2><a href={selected.neetcode_url ?? selected.leetcode_url ?? "#"} target="_blank" rel="noreferrer" aria-label={`Open ${selected.title}`}><ArrowUpRight size={18} /></a></div><div className="meta-pills"><span className={`difficulty difficulty-${selected.difficulty.toLowerCase()}`}>{selected.difficulty}</span>{selected.topics.map((topic) => <span className="topic-pill" key={topic}>{topic}</span>)}</div><p className="next-note">{selected.latest_note ? `“${selected.latest_note}”` : "Reconstruct the approach before checking a solution, then rate your recall."}</p></div></div>
            <div className="next-stats"><div><CalendarDays size={18} /><span>Last review<strong>{selected.latest_reviewed_at ? formatRelativeDue(selected.latest_reviewed_at).replace("overdue", "ago") : "First review"}</strong></span></div><div><RotateCcw size={18} /><span>Review number<strong>{selected.card.reps}</strong></span></div><div><BarChart3 size={18} /><span>Recall estimate<strong className="memory-value">{Math.round(selected.retrievability * 100)}%</strong></span></div></div>
            <div className="next-actions"><a className="primary-button" href={selected.neetcode_url ?? selected.leetcode_url ?? "#"} target="_blank" rel="noreferrer">Solve on NeetCode <ArrowUpRight size={17} /></a><button className="outline-button" onClick={() => setRecordingReview((value) => !value)}>{recordingReview ? "Close review" : "Record attempt"}</button></div>
          </section> : <section className="caught-up-card"><CheckCircle2 size={32} /><div><h2>Review queue clear.</h2><p>Your next review is {upcoming[0] ? formatRelativeDue(upcoming[0].card.due_at) : "waiting for your first solve"}.</p></div><Link className="outline-button" href="/schedule">View schedule</Link></section>}
          {queueCount > 1 && <div className="due-list">{queue.map((problem, index) => <button className={problem.id === selected?.id ? "queue-row active" : "queue-row"} onClick={() => { setSelectedId(problem.id); setRecordingReview(false); }} key={problem.id}><span>{index + 1}</span><span><strong>{problem.title}</strong><small>{problem.topics[0] ?? problem.difficulty}</small></span><span className={isOverdue(problem.card.due_at) ? "overdue-text" : "due-text"}>{isOverdue(problem.card.due_at) ? "Overdue" : "Due now"}</span><ChevronRight size={17} /></button>)}</div>}
        </section>
        <section className="daily-section new-section"><div className="section-title"><span><Lightbulb size={21} /> Today’s new problems</span>{plan.preferences.configured ? <span className="queue-count">{totalTarget} target</span> : null}</div>
          {!plan.preferences.configured ? <div className="plan-setup-card"><Settings2 size={25} /><div><h2>Choose a realistic study plan</h2><p>Set Easy, Medium, and Hard targets plus your study days. Due reviews will always remain visible.</p></div><Link href="/settings" className="primary-button">Set up plan</Link></div> : totalTarget === 0 ? <div className="plan-setup-card"><Settings2 size={25} /><div><h2>No new-problem target yet</h2><p>Set any difficulty above zero when you want fresh practice in addition to reviews.</p></div><Link href="/settings" className="outline-button">Edit plan</Link></div> : <div className="new-target-grid">{targets.map((target) => <NewTargetCard target={target} onRecord={(problem) => setSelectedNew(problem)} key={target.difficulty} />)}</div>}
        </section>
        <section className="upcoming-preview"><div className="section-title"><span><Clock3 size={20} /> Upcoming</span><Link href="/schedule">Full schedule <ChevronRight size={16} /></Link></div>{upcoming.length ? <div>{upcoming.slice(0, 7).map((problem) => <Link href={`/problems/${problem.id}`} key={problem.id}><span>{problem.title}<small>{problem.topics[0] ?? problem.difficulty}</small></span><strong>{formatRelativeDue(problem.card.due_at)}</strong></Link>)}</div> : <p className="empty-copy">Future reviews will appear after your first solve.</p>}</section>
      </div>
      <aside className="today-analytics">
        {recordingReview && selected && <section className="analytics-card side-review-panel"><div className="inline-review-heading"><div><h3>How did it go?</h3><p>{selected.title}</p></div><button onClick={() => setRecordingReview(false)} aria-label="Close review">×</button></div><ReviewRatingForm problemId={selected.id} options={optionsByProblem[selected.id] ?? []} onComplete={(result) => completeReview(selected.id, result.newIntervalDays)} /></section>}
        {selectedNew && <section className="analytics-card side-review-panel"><div className="inline-review-heading"><div><h3>First solve</h3><p>{selectedNew.title}</p></div><button onClick={() => setSelectedNew(null)} aria-label="Close first solve">×</button></div><a className="plain-link" href={selectedNew.neetcode_url ?? selectedNew.leetcode_url ?? "#"} target="_blank" rel="noreferrer">Open the problem <ArrowUpRight size={14} /></a><ReviewRatingForm problemId={selectedNew.id} options={ratingOptions(null)} onComplete={(result) => completeFirstSolve(selectedNew, result.newIntervalDays)} /></section>}
        <section className="analytics-card quick-stats"><div className="section-title"><span><Clock3 size={21} /> Today at a glance</span></div><div><span><strong>{stats.averageRetrievability == null ? "—" : `${Math.round(stats.averageRetrievability * 100)}%`}</strong><small>Estimated recall</small></span><span><strong>{stats.strongCount}</strong><small>Strong problems</small></span><span><strong>{queueCount}</strong><small>Due reviews</small></span></div></section>
      </aside>
    </div>
  </section>;
}

function NewTargetCard({ target, onRecord }: { target: DailyTarget; onRecord: (problem: ProblemSummary) => void }) {
  const done = target.target === 0 ? 0 : Math.min(target.target, target.completed);
  return <section className="new-target-card"><div><span className={`difficulty difficulty-${target.difficulty.toLowerCase()}`}>{target.difficulty}</span><strong>{done}/{target.target}</strong><small>completed today</small></div>{target.problems.length ? <div className="new-problem-list">{target.problems.map((problem) => <article key={problem.id}><span><strong>{problem.title}</strong><small>{problem.topics.join(" · ") || "New problem"}</small></span><button type="button" onClick={() => onRecord(problem)}>Record first solve</button></article>)}</div> : <p className="empty-copy">{target.remaining === 0 ? target.completed >= target.target ? "Target complete." : "No unused problems in this difficulty." : "No suggestion yet."}</p>}</section>;
}

function isOverdue(dueAt: string) {
  return Date.now() - new Date(dueAt).getTime() > 60 * 60 * 1000;
}
