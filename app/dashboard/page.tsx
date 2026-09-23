import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, Flame, Layers3, Plus, RefreshCw } from "lucide-react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { CATALOGS } from "@/lib/constants";
import { requireProfile } from "@/lib/auth";
import { getDashboardData } from "@/lib/queries";
import { formatRelativeDue, localDateKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

function streakFrom(logs: Array<{ reviewed_at: string }>, timezone: string): number {
  const days = new Set(logs.map((log) => localDateKey(new Date(log.reviewed_at), timezone)));
  let cursor = new Date();
  let streak = 0;
  while (days.has(localDateKey(cursor, timezone))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function activityDays(logs: Array<{ reviewed_at: string }>, timezone: string) {
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    const key = localDateKey(new Date(log.reviewed_at), timezone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from({ length: 35 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (34 - index));
    const key = localDateKey(day, timezone);
    return { key, count: counts.get(key) ?? 0, label: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: timezone }).format(day) };
  });
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const data = await getDashboardData();
  if (!data) return null;
  const today = localDateKey(new Date(), profile.timezone);
  const reviewedToday = data.logs.filter((log) => localDateKey(new Date(log.reviewed_at), profile.timezone) === today).length;
  const streak = streakFrom(data.logs, profile.timezone);
  const activity = activityDays(data.logs, profile.timezone);
  const upcoming = data.cards.filter((card: any) => new Date(card.due_at).getTime() > Date.now()).sort((a: any, b: any) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()).slice(0, 4);
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }}>
    <section className="page-heading dashboard-heading"><div><span className="eyebrow">{CATALOGS[profile.selected_catalog].name}</span><h1>Keep the hard-won patterns alive.</h1><p>{data.due.length ? `${data.due.length} problems are ready for a quick memory check.` : "Your queue is quiet for now. Add a solved problem when you are ready."}</p></div><Link className="outline-button" href="/catalog"><Plus size={17} /> Log a first solve</Link></section>
    <section className="hero-queue">
      <div className="hero-queue-copy"><span className="due-chip"><Clock3 size={16} /> Due now</span><strong>{data.due.length}</strong><h2>{data.due.length === 1 ? "problem wants a review" : "problems want a review"}</h2><p>{data.due.length ? "A few honest ratings now will protect the work you have already done." : "No reviews are waiting. Start something new or enjoy the breathing room."}</p></div>
      {data.due.length ? <Link className="primary-button review-cta" href="/review">Start review <ArrowRight size={18} /></Link> : <Link className="primary-button review-cta" href="/catalog">Browse catalog <BookOpen size={18} /></Link>}
    </section>
    <section className="stat-grid">
      <div className="stat-card"><span className="stat-icon cyan"><RefreshCw size={18} /></span><div><strong>{reviewedToday}</strong><span>reviews today</span></div></div>
      <div className="stat-card"><span className="stat-icon amber"><Flame size={18} /></span><div><strong>{streak}</strong><span>day streak</span></div></div>
      <div className="stat-card"><span className="stat-icon violet"><Layers3 size={18} /></span><div><strong>{data.cards.length}</strong><span>active problems</span></div></div>
      <div className="stat-card"><span className="stat-icon green"><CheckCircle2 size={18} /></span><div><strong>{data.cards.length}</strong><span>first solves logged</span></div></div>
    </section>
    <section className="dashboard-grid">
      <div className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">Consistency</span><h2>Last 5 weeks</h2></div><CalendarDays size={20} /></div><div className="activity-grid" aria-label="Review activity in the last five weeks">{activity.map((day) => <span key={day.key} title={`${day.label}: ${day.count} reviews`} className={`activity-cell level-${Math.min(day.count, 4)}`} />)}</div><div className="activity-key"><span>Less</span>{[0,1,2,3,4].map((level) => <i className={`activity-cell level-${level}`} key={level} />)}<span>More</span></div></div>
      <div className="panel upcoming-panel"><div className="panel-heading"><div><span className="eyebrow">Looking ahead</span><h2>Next in line</h2></div><Link href="/catalog">Catalog <ArrowRight size={14} /></Link></div>{upcoming.length ? <ul className="upcoming-list">{upcoming.map((card: any, index: number) => <li key={`${card.due_at}-${index}`}><span className="upcoming-dot" /><div><strong>{card.problems?.title ?? formatRelativeDue(card.due_at)}</strong><small>{formatRelativeDue(card.due_at)} · review #{card.reps}</small></div></li>)}</ul> : <p className="empty-copy">Once you log a solve, its future reviews appear here.</p>}</div>
      <div className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">Recent activity</span><h2>Your latest reviews</h2></div><Link href="/history">View history <ArrowRight size={14} /></Link></div>{data.logs.length ? <ul className="recent-list">{data.logs.slice(0, 5).map((log: any, index: number) => <li key={`${log.problem_id}-${log.reviewed_at}-${index}`}><span className={`review-dot ${log.rating}`} /><div><strong>{log.problems?.title ?? "Problem review"}</strong><small>{log.rating} · {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: profile.timezone }).format(new Date(log.reviewed_at))}</small></div></li>)}</ul> : <EmptyState title="Your history starts with one solve" body="Pick a familiar problem from the catalog and log how it went." action={<Link className="text-button" href="/catalog">Open catalog</Link>} />}</div>
    </section>
    <footer className="site-note">Recall Code is a personal practice tracker and is not affiliated with NeetCode or LeetCode.{data.snapshot && <> Catalog snapshot: {data.snapshot.version}.</>}</footer>
  </AppShell>;
}
