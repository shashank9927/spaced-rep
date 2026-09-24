"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Filter, Search, Sparkles } from "lucide-react";
import { CATALOGS } from "@/lib/constants";
import { setActiveCatalog } from "@/lib/actions";
import { ratingOptions } from "@/lib/scheduler";
import { cn, formatRelativeDue } from "@/lib/utils";
import { ReviewRatingForm } from "@/components/review-rating-form";
import type { CatalogId, CatalogProblem } from "@/lib/types";

type StatusFilter = "all" | "new" | "due" | "overdue" | "weak" | "strong";

export function CatalogClient({ initialCatalog, problems }: { initialCatalog: CatalogId; problems: CatalogProblem[] }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogId>(initialCatalog);
  const [catalogProblems, setCatalogProblems] = useState(problems);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<CatalogProblem | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const topics = useMemo(() => Array.from(new Set(catalogProblems.flatMap((problem) => problem.topics))).sort(), [catalogProblems]);
  const filtered = useMemo(() => catalogProblems.filter((problem) => {
    const dueAt = problem.card ? new Date(problem.card.due_at).getTime() : null;
    const due = dueAt != null && dueAt <= now;
    const overdue = dueAt != null && dueAt < now - 60 * 60 * 1000;
    const weak = Boolean(problem.card && ((problem.card.retrievability ?? 1) < .75 || problem.card.latest_rating === "again" || problem.card.latest_rating === "hard"));
    const strong = Boolean(problem.card && (problem.card.retrievability ?? 0) >= .9 && (problem.card.stability ?? 0) >= 30);
    const matchesStatus = status === "all" || (status === "new" && !problem.card) || (status === "due" && due) || (status === "overdue" && overdue) || (status === "weak" && weak) || (status === "strong" && strong);
    return matchesStatus && (difficulty === "all" || problem.difficulty === difficulty) && (topic === "all" || problem.topics.includes(topic)) && `${problem.title} ${problem.topics.join(" ")}`.toLowerCase().includes(search.toLowerCase());
  }), [catalogProblems, difficulty, topic, status, search, now]);

  function switchCatalog(value: CatalogId) {
    setCatalog(value);
    setError(null);
    startTransition(async () => {
      const result = await setActiveCatalog(value);
      if (!result.ok) return setError(result.error);
      setSelected(null);
      window.dispatchEvent(new Event("recallcode:catalog-changed"));
      router.refresh();
    });
  }

  return <div className="problems-workspace">
    <div className="catalog-header-row"><div className="segmented-control" aria-label="Study list">{(Object.keys(CATALOGS) as CatalogId[]).map((id) => <button type="button" onClick={() => switchCatalog(id)} className={cn(catalog === id && "selected")} disabled={pending} key={id}>{CATALOGS[id].name.replace("NeetCode ", "")}</button>)}</div><span className="muted-count">{catalogProblems.length} problems in this list</span></div>
    <div className="filter-tabs" aria-label="Problem status filter">{(["all", "due", "overdue", "weak", "strong", "new"] as StatusFilter[]).map((value) => <button key={value} className={status === value ? "selected" : ""} onClick={() => setStatus(value)}>{value === "all" ? "All" : value === "new" ? "New" : value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    <div className="filters-panel light-panel"><label className="search-box"><Search size={18} /><input placeholder="Search problems or patterns" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="filter-row"><Filter size={16} /><select aria-label="Difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option></select><select aria-label="Pattern" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All patterns</option>{topics.map((name) => <option key={name}>{name}</option>)}</select></div></div>
    {error && <p className="form-error">{error}</p>}
    {selected && <section className="first-solve-panel"><div className="inline-review-heading"><div><span>First solve</span><h2>{selected.title}</h2><p>Open the problem, solve it, then record how it went.</p></div><button onClick={() => setSelected(null)} aria-label="Close first solve">×</button></div><div className="external-links"><a className="primary-button" href={selected.neetcode_url ?? selected.leetcode_url ?? "#"} target="_blank" rel="noreferrer">Solve on NeetCode <ArrowUpRight size={16} /></a>{selected.leetcode_url && <a className="plain-link" href={selected.leetcode_url} target="_blank" rel="noreferrer">LeetCode <ArrowUpRight size={14} /></a>}</div><ReviewRatingForm problemId={selected.id} options={ratingOptions(null)} onComplete={(result) => { setCatalogProblems((items) => items.map((problem) => problem.id === selected.id ? { ...problem, card: { due_at: result.updatedCard.dueAt, reps: result.updatedCard.repetitions, last_review_at: new Date().toISOString(), stability: result.updatedCard.stability, lapses: result.updatedCard.lapses, scheduled_days: result.updatedCard.scheduledDays, first_solved_at: result.updatedCard.firstSolvedAt, retrievability: result.newRetrievability, latest_rating: null } } : problem)); setSelected(null); }} /></section>}
    <section className="problems-table-card"><div className="problems-table-head"><span>Problem</span><span>Pattern</span><span>Difficulty</span><span>Memory</span><span>Last reviewed</span><span>Next review</span><span>Status</span><span>Reviews</span></div>{filtered.map((problem) => <article className="problems-table-row" key={problem.id}><div><Link href={`/problems/${problem.id}`} className="problem-link">{problem.title}</Link><small>{problem.topics.slice(1).join(" · ")}</small></div><div>{problem.topics[0] ?? "—"}</div><div><span className={`difficulty difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span></div><div>{problem.card ? `${Math.round((problem.card.retrievability ?? 0) * 100)}%` : "—"}</div><div>{problem.card?.last_review_at ? formatRelativeDue(problem.card.last_review_at).replace("overdue", "ago") : "—"}</div><div>{problem.card ? formatRelativeDue(problem.card.due_at) : "—"}</div><div><Status card={problem.card} now={now} /></div><div>{problem.card?.reps ?? 0}</div><div className="problem-row-actions">{!problem.card ? <button className="start-button" onClick={() => setSelected(problem)}><Sparkles size={15} /> First solve</button> : new Date(problem.card.due_at).getTime() <= now ? <Link className="start-button" href="/review"><CheckCircle2 size={15} /> Review</Link> : <Link className="icon-link" href={`/problems/${problem.id}`} aria-label={`View ${problem.title}`}><ArrowUpRight size={18} /></Link>}</div></article>)}{filtered.length === 0 && <p className="empty-inline">No problems match those filters.</p>}</section>
  </div>;
}

function Status({ card, now }: { card: CatalogProblem["card"]; now: number }) {
  if (!card) return <span className="status-new">New</span>;
  const dueAt = new Date(card.due_at).getTime();
  if (dueAt <= now - 60 * 60 * 1000) return <span className="status-overdue">Overdue</span>;
  if (dueAt <= now) return <span className="status-due">Due now</span>;
  if ((card.retrievability ?? 0) < .75 || card.latest_rating === "again" || card.latest_rating === "hard") return <span className="status-weak">Weak</span>;
  if ((card.retrievability ?? 0) >= .9 && (card.stability ?? 0) >= 30) return <span className="status-strong">Strong</span>;
  return <span className="status-active">Learning</span>;
}
