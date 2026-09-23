import Link from "next/link";
import { BarChart3, CalendarDays, Clock3, Flame, Trophy } from "lucide-react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { getProgressData } from "@/lib/queries";
import { formatDateTime, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const profile = await requireProfile();
  const data = await getProgressData();
  if (!data) return null;
  const ratings = { again: 0, hard: 0, good: 0, easy: 0 };
  data.logs.forEach((log) => { ratings[log.rating] += 1; });
  const weekly = Array.from({ length: 12 }, (_, index) => data.activity.slice(index * 7, index * 7 + 7).reduce((sum, day) => sum + day.count, 0));
  const maxWeekly = Math.max(1, ...weekly);
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }} streak={data.stats.currentStreak}>
    <section className="page-heading compact-heading"><div><span className="eyebrow">Private analytics</span><h1>Progress</h1><p>Use these signals to find what is fading before it becomes a blind spot.</p></div></section>
    <section className="progress-summary"><Metric icon={<Flame size={21} />} value={`${data.stats.currentStreak}`} label="current streak" /><Metric icon={<Trophy size={21} />} value={`${data.stats.longestStreak}`} label="longest streak" /><Metric icon={<CalendarDays size={21} />} value={`${data.stats.reviewsThisWeek}`} label="reviews this week" /><Metric icon={<BarChart3 size={21} />} value={data.stats.recallSuccessRate == null ? "—" : `${Math.round(data.stats.recallSuccessRate * 100)}%`} label="recall success" /><Metric icon={<Clock3 size={21} />} value={formatDuration(data.stats.averageDuration)} label="average review" /></section>
    {!data.cards.length ? <EmptyState title="Your analytics will grow with each review" body="Log a first solve and RecallCode will build your private retention history." action={<Link className="primary-button" href="/problems">Open problems</Link>} /> : <div className="progress-layout"><section className="progress-card review-chart"><div className="section-title"><span><BarChart3 size={20} /> Reviews over time</span><span className="queue-count">Last 12 weeks</span></div><div className="bar-chart">{weekly.map((count, index) => <div key={index}><i style={{ height: `${Math.max(6, Math.round((count / maxWeekly) * 100))}%` }} title={`${count} reviews`} /><small>{count || ""}</small></div>)}</div></section>
      <section className="progress-card retention-breakdown"><div className="section-title"><span><Trophy size={20} /> Learning state</span></div><div className="state-bars"><div><span>Strong</span><b style={{ width: `${data.stats.activeCount ? Math.round(data.stats.strongCount / data.stats.activeCount * 100) : 0}%` }} /><strong>{data.stats.strongCount}</strong></div><div><span>Learning</span><b style={{ width: `${data.stats.activeCount ? Math.round(data.stats.learningCount / data.stats.activeCount * 100) : 0}%` }} /><strong>{data.stats.learningCount}</strong></div><div><span>Weak</span><b style={{ width: `${data.stats.activeCount ? Math.round(data.stats.weakCount / data.stats.activeCount * 100) : 0}%` }} /><strong>{data.stats.weakCount}</strong></div></div></section>
      <section className="progress-card activity-card"><div className="section-title"><span><CalendarDays size={20} /> Activity</span><span className="queue-count">12 weeks</span></div><div className="activity-grid activity-grid-large">{data.activity.map((day) => <i key={day.key} title={`${day.key}: ${day.count} reviews`} className={`activity-cell level-${Math.min(day.count, 4)}`} />)}</div></section>
      <section className="progress-card rating-distribution"><div className="section-title"><span><BarChart3 size={20} /> Rating distribution</span></div>{Object.entries(ratings).map(([rating, count]) => <div key={rating}><span className={`rating-pill ${rating}`}>{rating === "again" ? "Forgot" : rating}</span><b style={{ width: `${data.logs.length ? Math.round(count / data.logs.length * 100) : 0}%` }} /><strong>{count}</strong></div>)}</section>
      <section className="progress-card at-risk-card"><div className="section-title"><span><Flame size={20} /> Likely to fade soon</span></div>{data.stats.weak.length ? <div className="risk-list">{data.stats.weak.slice(0, 6).map((problem) => <Link href={`/problems/${problem.id}`} key={problem.id}><span>{problem.title}<small>{problem.topics[0] ?? ""}</small></span><strong>{Math.round(problem.retrievability * 100)}%</strong></Link>)}</div> : <p className="empty-copy">No weak cards right now.</p>}</section>
      <section className="progress-card progress-patterns"><div className="section-title"><span><BarChart3 size={20} /> Pattern retention</span></div>{data.patterns.slice(0, 8).map((pattern) => <Link href={`/patterns?topic=${encodeURIComponent(pattern.name)}`} key={pattern.name}><span>{pattern.name}</span><i><b style={{ width: `${Math.round(pattern.retrievability * 100)}%` }} /></i><strong>{Math.round(pattern.retrievability * 100)}%</strong></Link>)}</section>
      <section className="progress-card recent-history"><div className="section-title"><span><Clock3 size={20} /> Recent reviews</span></div>{data.logs.slice(0, 12).map((log) => <article key={log.id}><span className={`rating-pill ${log.rating}`}>{log.rating === "again" ? "Forgot" : log.rating}</span><div><strong>{log.problems?.title ?? "Problem review"}</strong><small>{formatDateTime(log.reviewed_at, profile.timezone)}{log.duration_minutes ? ` · ${formatDuration(log.duration_minutes)}` : ""}</small>{log.note && <blockquote>{log.note}</blockquote>}</div></article>)}</section>
    </div>}
  </AppShell>;
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>;
}
