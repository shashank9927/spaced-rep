"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Filter, Search, Sparkles } from "lucide-react";
import { CATALOGS } from "@/lib/constants";
import { setActiveCatalog } from "@/lib/actions";
import { ratingOptions } from "@/lib/scheduler";
import { cn, formatRelativeDue } from "@/lib/utils";
import { ReviewRatingForm } from "@/components/review-rating-form";
import type { CatalogId, CatalogProblem } from "@/lib/types";

type StatusFilter = "all" | "new" | "active" | "due";

export function CatalogClient({ initialCatalog, problems }: { initialCatalog: CatalogId; problems: CatalogProblem[] }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogId>(initialCatalog);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<CatalogProblem | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const topics = useMemo(() => Array.from(new Set(problems.flatMap((problem) => problem.topics))).sort(), [problems]);
  const filtered = useMemo(() => problems.filter((problem) => {
    const due = Boolean(problem.card && new Date(problem.card.due_at).getTime() <= Date.now());
    const problemStatus = !problem.card ? "new" : due ? "due" : "active";
    return (difficulty === "all" || problem.difficulty === difficulty)
      && (topic === "all" || problem.topics.includes(topic))
      && (status === "all" || problemStatus === status)
      && `${problem.title} ${problem.topics.join(" ")}`.toLowerCase().includes(search.toLowerCase());
  }), [problems, difficulty, topic, status, search]);

  function switchCatalog(value: CatalogId) {
    setCatalog(value);
    setError(null);
    startTransition(async () => {
      const result = await setActiveCatalog(value);
      if (!result.ok) return setError(result.error);
      setSelected(null);
      router.refresh();
    });
  }

  return <div className="catalog-workspace">
    <div className="catalog-header-row">
      <div className="segmented-control" aria-label="Study list">
        {(Object.keys(CATALOGS) as CatalogId[]).map((id) => <button type="button" onClick={() => switchCatalog(id)} className={cn(catalog === id && "selected")} disabled={pending} key={id}>{CATALOGS[id].name.replace("NeetCode ", "")}</button>)}
      </div>
      <span className="muted-count">{problems.length} problems in this list</span>
    </div>
    <div className="filters-panel">
      <label className="search-box"><Search size={18} /><input placeholder="Search a problem or topic" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="filter-row"><Filter size={16} />
        <select aria-label="Difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
        <select aria-label="Topic" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All topics</option>{topics.map((name) => <option key={name}>{name}</option>)}</select>
        <select aria-label="Review status" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">All statuses</option><option value="new">Not started</option><option value="active">In review</option><option value="due">Due now</option></select>
      </div>
    </div>
    {error && <p className="form-error">{error}</p>}
    {selected && <section className="start-review-panel" aria-live="polite">
      <div className="panel-heading"><div><span className="eyebrow">First solve</span><h2>{selected.title}</h2><p>Open the problem, solve it, then honestly rate how it went.</p></div><button className="text-button" onClick={() => setSelected(null)}>Close</button></div>
      <div className="external-links"><a className="outline-button" href={selected.neetcode_url ?? selected.leetcode_url ?? "#"} target="_blank" rel="noreferrer">Open problem <ArrowUpRight size={16} /></a>{selected.neetcode_url && selected.leetcode_url && <a className="plain-link" href={selected.leetcode_url} target="_blank" rel="noreferrer">LeetCode <ArrowUpRight size={14} /></a>}</div>
      <ReviewRatingForm problemId={selected.id} options={ratingOptions(null)} onComplete={() => { setSelected(null); router.refresh(); }} />
    </section>}
    <div className="problem-list" role="list">
      {filtered.map((problem) => {
        const isDue = problem.card && new Date(problem.card.due_at).getTime() <= Date.now();
        return <article className="problem-row" role="listitem" key={problem.id}>
          <div className="problem-order">{String(problem.sort_order + 1).padStart(3, "0")}</div>
          <div className="problem-main"><div className="problem-title-row"><h3>{problem.title}</h3><span className={`difficulty difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span></div><div className="topic-tags">{problem.topics.map((name) => <span key={name}>{name}</span>)}</div></div>
          <div className="problem-status">{!problem.card ? <span className="status-new">Not started</span> : isDue ? <span className="status-due">Due now</span> : <span className="status-active">{formatRelativeDue(problem.card.due_at)}</span>}</div>
          <div className="problem-actions">{!problem.card ? <button className="start-button" onClick={() => setSelected(problem)}><Sparkles size={16} /> Log first solve</button> : isDue ? <a className="start-button" href="/review"><CheckCircle2 size={16} /> Review</a> : <a className="icon-link" href={problem.neetcode_url ?? problem.leetcode_url ?? "#"} target="_blank" rel="noreferrer" aria-label={`Open ${problem.title}`}><ArrowUpRight size={18} /></a>}</div>
        </article>;
      })}
      {filtered.length === 0 && <div className="empty-inline">No problems match those filters.</div>}
    </div>
  </div>;
}
