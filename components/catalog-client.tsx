"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, ChevronDown, Filter, Search } from "lucide-react";
import { setActiveCatalog } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import type { CatalogId, CatalogProblemSummary } from "@/lib/types";
import { cn, formatDate, localDateKey } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetDismiss, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type StatusFilter = "all" | "due" | "new";

function DifficultyBadge({ difficulty }: { difficulty: CatalogProblemSummary["difficulty"] }) { return <Badge variant={difficulty.toLowerCase() as "easy" | "medium" | "hard"}>{difficulty}</Badge>; }

export function CatalogClient({ initialStatus = "all", initialTopic = "all", problems, timezone, catalogId, todayKey, counts }: { initialStatus?: StatusFilter; initialTopic?: string; problems: CatalogProblemSummary[]; timezone: string; catalogId: CatalogId; todayKey: string; counts?: { active: number; due: number } }) {
  const router = useRouter();
  const [catalogPending, startCatalogTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [topic, setTopic] = useState(initialTopic);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [visible, setVisible] = useState(60);
  const topics = useMemo(() => Array.from(new Set(problems.flatMap((problem) => problem.topics))).sort(), [problems]);
  const dueOnToday = useCallback((dueAt: string) => localDateKey(new Date(dueAt), timezone) <= todayKey, [timezone, todayKey]);
  const computedDueCount = useMemo(() => problems.filter((problem) => problem.card && dueOnToday(problem.card.due_at)).length, [dueOnToday, problems]);
  const computedActiveCount = useMemo(() => problems.filter((problem) => problem.card).length, [problems]);
  const dueCount = counts?.due ?? computedDueCount;
  const activeCount = counts?.active ?? computedActiveCount;
  const filtered = useMemo(() => problems.filter((problem) => {
    const isDue = Boolean(problem.card && dueOnToday(problem.card.due_at));
    return (status === "all" || status === "due" && isDue || status === "new" && !problem.card)
      && (difficulty === "all" || problem.difficulty === difficulty)
      && (topic === "all" || problem.topics.includes(topic))
      && `${problem.leetcodeNumber} ${problem.title} ${problem.topics.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [difficulty, dueOnToday, problems, search, status, topic]);
  const visibleProblems = filtered.slice(0, visible);
  const activeFilters = [status !== "all" ? status === "due" ? "Due" : "New" : null, difficulty !== "all" ? difficulty : null, topic !== "all" ? topic : null, search.trim() ? `“${search.trim()}”` : null].filter(Boolean) as string[];
  const changeFilter = (next: StatusFilter) => { setStatus(next); setVisible(60); };
  const changeCatalog = (value: string) => {
    if (!(value in CATALOGS) || value === catalogId) return;
    startCatalogTransition(async () => {
      const result = await setActiveCatalog(value);
      if (!result.ok) { toast.error(result.error); return; }
      window.dispatchEvent(new CustomEvent("recallcode:catalog-changed", { detail: value }));
      toast.success(`Browsing ${CATALOGS[value as CatalogId].name}`);
      router.refresh();
    });
  };

  return <section className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-info" />Problem deck</div><h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Problems</h1><p className="mt-2 text-sm text-muted-foreground">Choose any problem manually. Your review queue follows active cards across all catalogs.</p></div><label className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-xs"><span className="whitespace-nowrap text-muted-foreground">Browsing catalog</span><select aria-label="Browsing catalog" value={catalogId} disabled={catalogPending} onChange={(event) => changeCatalog(event.target.value)} className="min-w-0 max-w-40 bg-transparent text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <option key={id} value={id}>{info.name}</option>)}</select></label></header>

    <section className="mb-4 grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3"><MiniStat label="Active" value={activeCount} detail="Started problems" /><MiniStat label="Due" value={dueCount} detail="Due today or overdue" tone={dueCount ? "due" : undefined} /><MiniStat label="New" value={problems.length - activeCount} detail="Not started" /></section>

    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center"><div className="flex rounded-md border border-border bg-card p-1" aria-label="Problem status">{(["all", "due", "new"] as StatusFilter[]).map((value) => <button type="button" aria-pressed={status === value} onClick={() => changeFilter(value)} className={cn("min-h-8 rounded px-3 text-xs font-medium text-muted-foreground hover:text-foreground", status === value && "bg-accent text-accent-foreground shadow-sm")} key={value}>{value === "all" ? `All ${problems.length}` : value === "due" ? `Due ${dueCount}` : `New ${problems.length - activeCount}`}</button>)}</div><label className="relative flex-1"><span className="sr-only">Filter problems</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setVisible(60); }} placeholder="Filter by number, title, or pattern" className="bg-card pl-9" /></label><div className="hidden sm:block"><Popover.Root><Popover.Trigger asChild><Button variant="outline" type="button"><Filter size={15} /> Filters{difficulty !== "all" || topic !== "all" ? <span className="size-1.5 rounded-full bg-info" /> : <ChevronDown size={14} />}</Button></Popover.Trigger><Popover.Portal><Popover.Content align="end" sideOffset={8} className="z-40 w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl"><FilterFields difficulty={difficulty} setDifficulty={setDifficulty} topic={topic} setTopic={setTopic} topics={topics} resetVisible={() => setVisible(60)} /></Popover.Content></Popover.Portal></Popover.Root></div><div className="sm:hidden"><Sheet><SheetTrigger asChild><Button className="w-full" variant="outline" type="button"><Filter size={15} /> Filters{difficulty !== "all" || topic !== "all" ? <span className="size-1.5 rounded-full bg-info" /> : null}</Button></SheetTrigger><SheetContent className="max-w-sm"><SheetHeader><div><SheetTitle>Problem filters</SheetTitle><SheetDescription>Limit the current browsing catalog by difficulty or pattern.</SheetDescription></div><SheetDismiss /></SheetHeader><div className="p-4"><FilterFields difficulty={difficulty} setDifficulty={setDifficulty} topic={topic} setTopic={setTopic} topics={topics} resetVisible={() => setVisible(60)} /></div></SheetContent></Sheet></div></div>

    <div className="overflow-hidden rounded-lg border border-border bg-card"><div className="hidden grid-cols-[4.25rem_minmax(0,1fr)_9rem_6rem_7rem_1.5rem] gap-3 border-b border-border bg-muted/40 px-4 py-2.5 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-muted-foreground md:grid"><span>Number</span><span>Problem</span><span>Pattern</span><span>Level</span><span>Schedule</span><span /></div><div className="divide-y divide-border">{visibleProblems.map((problem) => { const dateKey = problem.card ? localDateKey(new Date(problem.card.due_at), timezone) : null; const due = Boolean(dateKey && dateKey <= todayKey); const dueLabel = !dateKey ? "New" : dateKey < todayKey ? "Overdue" : dateKey === todayKey ? "Due today" : `Scheduled · ${formatDate(problem.card!.due_at, timezone)}`; const primaryTopic = problem.primaryTopic ?? problem.topics[0] ?? "Problem"; return <Link href={`/problems/${problem.id}`} scroll={false} className="group grid min-h-16 grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-accent md:grid-cols-[4.25rem_minmax(0,1fr)_9rem_6rem_9rem_1.5rem] md:gap-3" key={problem.id}><span className="font-mono text-xs text-muted-foreground">#{problem.leetcodeNumber}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{problem.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground md:hidden">{primaryTopic} · {dueLabel}</span></span><span className="hidden truncate text-xs text-muted-foreground md:block">{primaryTopic}</span><span className="hidden md:block"><DifficultyBadge difficulty={problem.difficulty} /></span><span>{!problem.card ? <Badge variant="muted">New</Badge> : due ? <Badge variant="due">{dueLabel}</Badge> : <span className="text-xs text-muted-foreground">{problem.card.scheduled_days ? `${problem.card.scheduled_days}d · ` : ""}{dueLabel}</span>}</span><ArrowUpRight size={14} className="hidden text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 md:block" /></Link>; })}</div>{filtered.length === 0 && <div className="px-4 py-10 text-center"><p className="text-sm text-muted-foreground">No problems match {activeFilters.length ? activeFilters.join(", ") : "the current view"}.</p><p className="mt-1 text-xs text-muted-foreground">Adjust one filter or return to the complete catalog.</p><div className="mt-3 flex flex-wrap justify-center gap-2">{status !== "all" && <Button size="sm" variant="outline" type="button" onClick={() => setStatus("all")}>Clear {status}</Button>}{difficulty !== "all" && <Button size="sm" variant="outline" type="button" onClick={() => setDifficulty("all")}>Clear {difficulty}</Button>}{topic !== "all" && <Button size="sm" variant="outline" type="button" onClick={() => setTopic("all")}>Clear {topic}</Button>}{search && <Button size="sm" variant="outline" type="button" onClick={() => setSearch("")}>Clear search</Button>}<Button size="sm" type="button" onClick={() => { setSearch(""); setDifficulty("all"); setTopic("all"); setStatus("all"); }}>Reset all</Button></div></div>}{visible < filtered.length && <div className="border-t border-border p-3 text-center"><Button variant="ghost" type="button" onClick={() => setVisible((value) => value + 60)}>Show 60 more</Button></div>}</div>
  </section>;
}

function FilterFields({ difficulty, setDifficulty, topic, setTopic, topics, resetVisible }: { difficulty: string; setDifficulty: (value: string) => void; topic: string; setTopic: (value: string) => void; topics: string[]; resetVisible: () => void }) {
  return <div className="space-y-4"><fieldset><legend className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</legend><div className="flex flex-wrap gap-1">{["all", "Easy", "Medium", "Hard"].map((value) => <button type="button" aria-pressed={difficulty === value} className={cn("min-h-9 rounded-md px-3 text-xs", difficulty === value ? "bg-accent text-accent-foreground" : "hover:bg-accent")} onClick={() => { setDifficulty(value); resetVisible(); }} key={value}>{value === "all" ? "All" : value}</button>)}</div></fieldset><label className="block text-xs font-medium text-muted-foreground">Pattern<Select className="mt-2" value={topic} onChange={(event) => { setTopic(event.target.value); resetVisible(); }}><option value="all">All patterns</option>{topics.map((name) => <option key={name}>{name}</option>)}</Select></label></div>;
}

function MiniStat({ label, value, detail, tone }: { label: string; value: number; detail: string; tone?: "due" }) {
  return <div className="border-b border-border px-4 py-3 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div className="flex items-baseline justify-between gap-3"><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><strong className={cn("text-lg font-semibold", tone === "due" && "text-destructive")}>{value}</strong></div><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div>;
}
