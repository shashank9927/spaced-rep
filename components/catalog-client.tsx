"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Filter, Search } from "lucide-react";
import { setActiveCatalog } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import type { CatalogId, CatalogProblem } from "@/lib/types";
import { cn, formatRelativeDue } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StatusFilter = "all" | "due" | "new";

function DifficultyBadge({ difficulty }: { difficulty: CatalogProblem["difficulty"] }) { return <Badge variant={difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{difficulty}</Badge>; }

export function CatalogClient({ initialCatalog, initialStatus = "all", initialTopic = "all", problems }: { initialCatalog: CatalogId; initialStatus?: StatusFilter; initialTopic?: string; problems: CatalogProblem[] }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogId>(initialCatalog);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [topic, setTopic] = useState(initialTopic);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [visible, setVisible] = useState(60);
  const [now] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const topics = useMemo(() => Array.from(new Set(problems.flatMap((problem) => problem.topics))).sort(), [problems]);
  const filtered = useMemo(() => problems.filter((problem) => {
    const isDue = Boolean(problem.card && new Date(problem.card.due_at).getTime() <= now);
    return (status === "all" || status === "due" && isDue || status === "new" && !problem.card)
      && (difficulty === "all" || problem.difficulty === difficulty)
      && (topic === "all" || problem.topics.includes(topic))
      && `${problem.leetcodeNumber} ${problem.title} ${problem.topics.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [difficulty, now, problems, search, status, topic]);
  const visibleProblems = filtered.slice(0, visible);
  const switchCatalog = (value: CatalogId) => {
    if (value === catalog) return;
    setCatalog(value);
    startTransition(async () => {
      const result = await setActiveCatalog(value);
      if (!result.ok) { setCatalog(initialCatalog); return; }
      window.dispatchEvent(new Event("recallcode:catalog-changed"));
      router.refresh();
    });
  };
  const changeFilter = (next: StatusFilter) => { setStatus(next); setVisible(60); };
  return <section>
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-sm text-muted-foreground">Your shared library</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Problems</h1><p className="mt-2 text-sm text-muted-foreground">Progress stays with a problem even when you switch catalogs.</p></div><span className="text-sm text-muted-foreground">{problems.length} problems</span></header>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-md border border-border bg-card p-1" aria-label="Study list">{(Object.keys(CATALOGS) as CatalogId[]).map((id) => <button type="button" disabled={pending} onClick={() => switchCatalog(id)} className={cn("min-h-8 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50", catalog === id && "bg-accent text-accent-foreground shadow-sm")} key={id}>{CATALOGS[id].name.replace("NeetCode ", "")}</button>)}</div><div className="flex rounded-md border border-border bg-card p-1">{(["all", "due", "new"] as StatusFilter[]).map((value) => <button type="button" onClick={() => changeFilter(value)} className={cn("min-h-8 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", status === value && "bg-accent text-accent-foreground shadow-sm")} key={value}>{value === "all" ? "All" : value === "due" ? "Due" : "New"}</button>)}</div></div>
    <div className="mb-4 flex flex-col gap-2 sm:flex-row"><label className="flex min-h-10 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3"><Search size={16} className="text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setVisible(60); }} placeholder="Filter by number, title, or pattern" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label><Popover.Root><Popover.Trigger asChild><Button variant="outline" type="button"><Filter size={15} /> Filters <ChevronDown size={14} /></Button></Popover.Trigger><Popover.Portal><Popover.Content align="end" sideOffset={8} className="z-40 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Difficulty</p><div className="flex flex-wrap gap-1">{["all", "Easy", "Medium", "Hard"].map((value) => <button type="button" className={cn("min-h-8 rounded px-2 text-xs", difficulty === value ? "bg-accent text-accent-foreground" : "hover:bg-accent")} onClick={() => { setDifficulty(value); setVisible(60); }} key={value}>{value === "all" ? "All" : value}</button>)}</div><p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pattern</p><select value={topic} onChange={(event) => { setTopic(event.target.value); setVisible(60); }} className="min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"><option value="all">All patterns</option>{topics.map((name) => <option key={name}>{name}</option>)}</select></Popover.Content></Popover.Portal></Popover.Root></div>
    <div className="overflow-hidden rounded-lg border border-border bg-card"><div className="hidden grid-cols-[4.5rem_minmax(0,1fr)_8rem_8rem_8rem] gap-3 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid"><span>Number</span><span>Problem</span><span>Pattern</span><span>Difficulty</span><span>Status</span></div><div className="divide-y divide-border">{visibleProblems.map((problem) => { const due = Boolean(problem.card && new Date(problem.card.due_at).getTime() <= now); return <article className="grid min-h-16 grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-accent md:grid-cols-[4.5rem_minmax(0,1fr)_8rem_8rem_8rem] md:gap-3" key={problem.id}><span className="font-mono text-xs text-muted-foreground">#{problem.leetcodeNumber}</span><Link href={`/problems/${problem.id}`} scroll={false} className="min-w-0"><span className="block truncate text-sm font-medium">{problem.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground md:hidden">{problem.topics[0] ?? "Problem"} · {problem.card ? formatRelativeDue(problem.card.due_at) : "New"}</span></Link><span className="hidden truncate text-xs text-muted-foreground md:block">{problem.topics[0] ?? "—"}</span><span className="hidden md:block"><DifficultyBadge difficulty={problem.difficulty} /></span><span>{!problem.card ? <Badge variant="muted">New</Badge> : due ? <Badge variant="due">Due</Badge> : <span className="text-xs text-muted-foreground">{formatRelativeDue(problem.card.due_at)}</span>}</span></article>; })}</div>{filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No problems match those filters.</p>}{visible < filtered.length && <div className="border-t border-border p-3 text-center"><Button variant="ghost" type="button" onClick={() => setVisible((value) => value + 60)}>Show 60 more</Button></div>}</div>
  </section>;
}
