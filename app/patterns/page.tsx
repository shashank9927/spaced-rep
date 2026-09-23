import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { getPatternsData } from "@/lib/queries";
import { formatRelativeDue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PatternsPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const profile = await requireProfile();
  const [{ topic }, data] = await Promise.all([searchParams, getPatternsData()]);
  if (!data) return null;
  const selected = data.patterns.find((pattern) => pattern.name === topic) ?? null;
  return <AppShell profile={{ display_name: profile.display_name!, email: profile.email, role: profile.role }} streak={data.stats.currentStreak}>
    <section className="page-heading compact-heading"><div><span className="eyebrow">Pattern recall</span><h1>Patterns</h1><p>See where your memory is strongest and which approaches need another pass.</p></div></section>
    {data.patterns.length ? <div className="patterns-layout"><section className="pattern-list-card">{data.patterns.map((pattern) => <Link href={`/patterns?topic=${encodeURIComponent(pattern.name)}`} className={selected?.name === pattern.name ? "pattern-list-row selected" : "pattern-list-row"} key={pattern.name}><span><strong>{pattern.name}</strong><small>{pattern.activeCount} active problem{pattern.activeCount === 1 ? "" : "s"}</small></span><i><b style={{ width: `${Math.round(pattern.retrievability * 100)}%` }} /></i><em>{Math.round(pattern.retrievability * 100)}%</em><ArrowRight size={17} /></Link>)}</section>
      <section className="pattern-detail-card">{selected ? <><div className="section-title"><span><BarChart3 size={20} /> {selected.name}</span><span className="queue-count">{Math.round(selected.retrievability * 100)}% estimated recall</span></div><p className="subtle-copy">Problems are ordered from weakest memory to strongest.</p><div className="pattern-problems">{selected.problems.map((problem) => <Link href={`/problems/${problem.id}`} key={problem.id}><span><strong>{problem.title}</strong><small>{problem.topics.join(" · ")}</small></span><span className={`difficulty difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span><span>{Math.round(problem.retrievability * 100)}%</span><small>{formatRelativeDue(problem.card.due_at)}</small></Link>)}</div></> : <div className="pattern-placeholder"><BarChart3 size={30} /><h2>Choose a pattern</h2><p>Select a row to see its problems ordered by current forgetting risk.</p></div>}</section></div> : <EmptyState title="Patterns appear after your first solve" body="Once you log a problem, RecallCode can estimate memory by DSA pattern." action={<Link className="primary-button" href="/problems">Open problems</Link>} />}
  </AppShell>;
}
