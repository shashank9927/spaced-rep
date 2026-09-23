import { BarChart3, CalendarDays, FileText } from "lucide-react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { getReviewHistory } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const profile = await requireProfile();
  const logs = await getReviewHistory();
  const counts = { again: 0, hard: 0, good: 0, easy: 0 };
  logs.forEach((log: any) => { counts[log.rating as keyof typeof counts] += 1; });
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }}><section className="page-heading compact-heading"><div><span className="eyebrow">Private record</span><h1>Review history</h1><p>Your ratings and notes are only visible to you.</p></div></section><section className="history-stats"><div><BarChart3 size={19} /><strong>{logs.length}</strong><span>total ratings</span></div><div><CalendarDays size={19} /><strong>{counts.good + counts.easy}</strong><span>confident recalls</span></div><div><FileText size={19} /><strong>{logs.filter((log: any) => log.note).length}</strong><span>notes written</span></div></section>{logs.length ? <section className="history-list">{logs.map((log: any) => <article className="history-row" key={log.id}><span className={`rating-pill ${log.rating}`}>{log.rating}</span><div className="history-main"><h2>{log.problems?.title ?? "Problem review"}</h2><p>{formatDateTime(log.reviewed_at, profile.timezone)} · next review in {log.scheduled_days}d</p>{log.note && <blockquote>{log.note}</blockquote>}</div></article>)}</section> : <EmptyState title="No ratings yet" body="Your review record will grow as you add solved problems from the catalog." />}</AppShell>;
}
