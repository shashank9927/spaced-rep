"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, FileText, History, RotateCcw } from "lucide-react";
import { ReviewRatingForm } from "@/components/review-rating-form";
import type { StudyCard } from "@/lib/analytics";
import type { ProblemSummary, RatingOption, ReviewLogSummary } from "@/lib/types";
import { formatDate, formatDateTime, formatDuration, formatRelativeDue } from "@/lib/utils";

export function ProblemDetailClient({ problem, card, logs, averageDuration, timezone, options }: { problem: ProblemSummary; card: StudyCard | null; logs: ReviewLogSummary[]; averageDuration: number | null; timezone: string; options: RatingOption[] }) {
  const [recording, setRecording] = useState(false);
  const [now] = useState(() => Date.now());
  const isDue = card && new Date(card.card.due_at).getTime() <= now;
  return <section className="problem-detail"><Link href="/problems" className="back-link light-back"><ArrowLeft size={16} /> Problems</Link><div className="detail-title"><div><h1>{problem.title}</h1><div className="meta-pills"><span className={`difficulty difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>{problem.topics.map((topic) => <span className="topic-pill" key={topic}>{topic}</span>)}</div></div><div className="detail-links"><a className="primary-button" href={problem.neetcode_url ?? problem.leetcode_url ?? "#"} target="_blank" rel="noreferrer">Solve on NeetCode <ArrowUpRight size={16} /></a>{problem.leetcode_url && <a className="outline-button" href={problem.leetcode_url} target="_blank" rel="noreferrer">LeetCode <ArrowUpRight size={16} /></a>}</div></div>
    <section className="detail-stat-grid"><Stat icon={<BarIcon />} label="Memory strength" value={card ? `${Math.round(card.retrievability * 100)}%` : "—"} /><Stat icon={<RotateCcw size={19} />} label="Current interval" value={card ? `${card.card.scheduled_days} days` : "Not started"} /><Stat icon={<CalendarDays size={19} />} label="Next review" value={card ? formatRelativeDue(card.card.due_at) : "—"} /><Stat icon={<Clock3 size={19} />} label="Average time" value={formatDuration(averageDuration)} /></section>
    <section className="detail-grid"><div className="detail-main-card"><div className="section-title"><span><History size={20} /> Review history</span>{card && <span className="queue-count">{card.card.reps} reviews</span>}</div>{logs.length ? <div className="detail-history">{logs.map((log) => <article key={log.id}><span className={`rating-pill ${log.rating}`}>{log.rating === "again" ? "Forgot" : log.rating}</span><div><strong>{formatDateTime(log.reviewed_at, timezone)}</strong><small>{log.duration_minutes ? `${formatDuration(log.duration_minutes)} · ` : ""}{log.pattern_recall ? `Pattern: ${log.pattern_recall}` : ""}</small>{log.note && <blockquote>{log.note}</blockquote>}</div><span className="next-interval">Next: {log.scheduled_days}d</span></article>)}</div> : <div className="empty-state"><FileText size={26} /><h2>No reviews yet</h2><p>Log your first solve after you complete this problem.</p></div>}</div>
      <aside className="detail-side-card"><span className="eyebrow">Your review</span><h2>{!card ? "Start this problem" : isDue ? "Ready for a review" : "Keep it fresh"}</h2><p>{!card ? "Solve it externally, then create its first review card." : isDue ? "Try from scratch before recording how it went." : `Scheduled ${formatRelativeDue(card.card.due_at)}.`}</p>{(!card || isDue) && <button className="primary-button" onClick={() => setRecording((value) => !value)}>{recording ? "Close review" : !card ? "Log first solve" : "Record attempt"}</button>}{card && <dl><div><dt>First solved</dt><dd>{formatDate(card.card.first_solved_at, timezone)}</dd></div><div><dt>Last result</dt><dd>{card.latest_rating ? card.latest_rating === "again" ? "Forgot" : card.latest_rating : "—"}</dd></div><div><dt>Reviews</dt><dd>{card.card.reps}</dd></div></dl>}</aside></section>
    {recording && <section className="detail-review-panel"><div className="inline-review-heading"><div><h2>How did {problem.title} go?</h2><p>Rate what you could recall before consulting a solution.</p></div><button onClick={() => setRecording(false)} aria-label="Close review">×</button></div><ReviewRatingForm problemId={problem.id} options={options} onComplete={() => window.location.reload()} /></section>}
  </section>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>;
}

function BarIcon() { return <span className="stat-bars">▮▮▮</span>; }
