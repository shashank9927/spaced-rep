"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Clock3 } from "lucide-react";
import type { ScheduleAgendaPayload, ScheduleDay, ScheduleItem } from "@/lib/types";
import type { ScheduleData } from "@/lib/study-plan";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

const dateFor = (key: string) => new Date(`${key}T12:00:00.000Z`);
const keyFor = (date: Date) => date.toISOString().slice(0, 10);
const label = (key: string) => new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(dateFor(key));
function shift(month: string, amount: number) { const [year, value] = month.split("-").map(Number); const date = new Date(Date.UTC(year, value - 1 + amount, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }
function description(item: ScheduleItem) { return item.kind === "completed-attempt" ? "First attempt recorded" : item.kind === "completed-early-review" ? "Early review complete" : item.kind === "completed-review" ? "Scheduled review complete" : item.status === "overdue" ? "Overdue review" : "Scheduled review"; }

export function ScheduleClient({ agendaData, monthData }: { agendaData: ScheduleAgendaPayload; monthData: ScheduleData | null }) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState(() => {
    if (!monthData) return agendaData.todayKey;
    if (monthData.month === agendaData.todayKey.slice(0, 7)) return agendaData.todayKey;
    const inMonth = monthData.days.filter((day) => day.dateKey.startsWith(monthData.month));
    return inMonth.find((day) => day.items.length > 0)?.dateKey ?? inMonth[0]?.dateKey ?? agendaData.todayKey;
  });
  const [pending, startTransition] = useTransition();
  const agenda = agendaData.days;
  const showMonth = Boolean(monthData);
  const selected = monthData?.days.find((day) => day.dateKey === selectedKey) ?? agenda.find((day) => day.dateKey === selectedKey) ?? agenda[0];
  const modifiers = useMemo(() => ({
    review: (monthData?.days ?? []).filter((day) => day.items.some((item) => item.kind === "review" && item.status !== "completed")).map((day) => dateFor(day.dateKey)),
    completed: (monthData?.days ?? []).filter((day) => day.items.some((item) => item.status === "completed")).map((day) => dateFor(day.dateKey)),
  }), [monthData]);
  const navigate = (month: string) => startTransition(() => router.push(`/schedule?view=month&month=${month}`));
  const toggleMonth = () => startTransition(() => router.push(showMonth ? "/schedule" : `/schedule?view=month&month=${agendaData.todayKey.slice(0, 7)}`));
  return <section className="mx-auto max-w-5xl"><header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-primary">Your real review timeline</p><h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Schedule</h1><p className="mt-2 text-sm text-muted-foreground">Only recorded attempts and FSRS review dates appear here. Dates update when you review.</p></div><Button variant="outline" type="button" disabled={pending} onClick={toggleMonth}><CalendarDays size={16} /> {showMonth ? "Hide month" : "Month overview"}</Button></header><section className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Next 14 days</h2><p className="mt-1 text-xs text-muted-foreground">Due reviews are never capped or hidden.</p></div><div className="divide-y divide-border">{agenda.map((day) => <AgendaDay key={day.dateKey} day={day} todayKey={agendaData.todayKey} selected={selectedKey === day.dateKey} onSelect={() => setSelectedKey(day.dateKey)} />)}</div></section>{selected && <DayDetail day={selected} todayKey={agendaData.todayKey} />}{monthData && <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-4 py-3"><Button variant="ghost" size="icon-sm" aria-label="Previous month" disabled={pending} onClick={() => navigate(shift(monthData.month, -1))}><ChevronLeft size={17} /></Button><strong className="text-sm">{new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(dateFor(`${monthData.month}-01`))}</strong><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={pending || monthData.month === agendaData.todayKey.slice(0, 7)} onClick={() => navigate(agendaData.todayKey.slice(0, 7))}>Today</Button><Button variant="ghost" size="icon-sm" aria-label="Next month" disabled={pending || monthData.month >= agendaData.maxMonth} onClick={() => navigate(shift(monthData.month, 1))}><ChevronRight size={17} /></Button></div></div><Calendar month={dateFor(`${monthData.month}-01`)} selected={dateFor(selectedKey)} onSelect={(date) => { const key = keyFor(date); if (monthData.days.some((day) => day.dateKey === key)) setSelectedKey(key); }} modifiers={modifiers} /><div className="flex flex-wrap gap-3 border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-amber-400" />Review</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-emerald-400" />Completed</span></div></section>}</section>;
}

function AgendaDay({ day, todayKey, selected, onSelect }: { day: ScheduleDay; todayKey: string; selected: boolean; onSelect: () => void }) {
  const reviews = day.items.filter((item) => item.kind === "review" && item.status !== "completed").length;
  const completed = day.items.filter((item) => item.status === "completed").length;
  return <button type="button" onClick={onSelect} className={cn("grid min-h-16 w-full grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent", selected && "bg-accent")}><span><strong className="block text-sm font-medium">{label(day.dateKey)}</strong><span className="text-xs text-muted-foreground">{day.dateKey === todayKey ? "Today" : day.dateKey < todayKey ? "Past" : "Upcoming"}</span></span><span className="min-w-0 truncate text-sm text-muted-foreground">{reviews ? `${reviews} review${reviews === 1 ? "" : "s"}` : completed ? `${completed} complete` : "No scheduled reviews"}</span><ChevronRight size={16} className="text-muted-foreground" /></button>;
}

function DayDetail({ day, todayKey }: { day: ScheduleDay; todayKey: string }) {
  return <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card"><div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">{label(day.dateKey)}</h2><p className="mt-0.5 text-xs text-muted-foreground">{day.dateKey > todayKey ? "Scheduled FSRS reviews." : day.dateKey === todayKey ? "Your current review day." : "Completed work is private."}</p></div><Badge variant="muted">{day.items.filter((item) => item.kind === "review").length} reviews</Badge></div><div className="divide-y divide-border">{day.items.length ? day.items.map((item, index) => <div className="flex min-h-14 items-center gap-3 px-4 py-2.5" key={`${item.kind}-${item.problem.id}-${index}`}><span className="text-muted-foreground">{item.status === "completed" ? <CircleCheck size={16} className="text-emerald-400" /> : <Clock3 size={16} />}</span><span className="font-mono text-xs text-muted-foreground">#{item.problem.leetcodeNumber}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.problem.title}</span><span className="text-xs text-muted-foreground">{description(item)}{item.status === "overdue" && item.originalDueDateKey ? ` · originally due ${label(item.originalDueDateKey)}` : ""}</span></span>{item.status !== "completed" && <Link href={item.status === "upcoming" ? `/problems/${item.problem.id}` : "/review"} className="text-xs font-medium text-primary hover:underline">{item.status === "upcoming" ? "View problem" : "Open reviews"}</Link>}</div>) : <p className="px-4 py-7 text-sm text-muted-foreground">No recorded work or scheduled reviews on this day.</p>}</div></section>;
}
