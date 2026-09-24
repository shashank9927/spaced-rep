"use client";

import { useState, useTransition } from "react";
import { Check, Save } from "lucide-react";
import { saveSettings, saveStudyPlanPreferences } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import { STUDY_WEEKDAYS, type CatalogId, type StudyPlanPreferences, type StudyWeekday } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const weekdayLabels: Record<StudyWeekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export function SettingsForm({ displayName, timezone, selectedCatalog, studyPlan }: { displayName: string; timezone: string; selectedCatalog: CatalogId; studyPlan: StudyPlanPreferences }) {
  const [name, setName] = useState(displayName);
  const [zone, setZone] = useState(timezone);
  const [catalog, setCatalog] = useState<CatalogId>(selectedCatalog);
  const [easy, setEasy] = useState(studyPlan.easyPerDay);
  const [medium, setMedium] = useState(studyPlan.mediumPerDay);
  const [hard, setHard] = useState(studyPlan.hardPerDay);
  const [days, setDays] = useState<StudyWeekday[]>(studyPlan.studyDays);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = easy + medium + hard;
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
  const updateTarget = (set: (value: number) => void, raw: string) => set(Math.max(0, Math.min(10, Number(raw) || 0)));
  const toggleDay = (day: StudyWeekday) => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  const save = () => startTransition(async () => {
    setMessage(null);
    const settings = await saveSettings({ displayName: name, timezone: zone, selectedCatalog: catalog });
    if (!settings.ok) { setMessage(settings.error); return; }
    const plan = await saveStudyPlanPreferences({ easyPerDay: easy, mediumPerDay: medium, hardPerDay: hard, studyDays: days });
    if (!plan.ok) { setMessage(plan.error); return; }
    if (catalog !== selectedCatalog) window.dispatchEvent(new CustomEvent("recallcode:catalog-changed", { detail: catalog }));
    setMessage("Settings saved.");
  });
  return <form className="mx-auto max-w-2xl space-y-5" onSubmit={(event) => { event.preventDefault(); save(); }}><header><p className="mb-1 text-sm text-muted-foreground">Account and workload</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Keep this simple: choose your catalog and realistic new-problem workload. Reviews are always shown when due.</p></header><section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Study plan</h2></div><div className="space-y-5 p-4"><div><label className="text-sm font-medium">New problems per active day</label><p className="mt-1 text-xs text-muted-foreground">Set any target to zero. The combined maximum is 10.</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{([ ["Easy", easy, setEasy], ["Medium", medium, setMedium], ["Hard", hard, setHard] ] as const).map(([label, value, setValue]) => <label className="rounded-md border border-border p-3" key={label}><span className="block text-sm font-medium">{label}</span><input aria-label={`${label} problems per active day`} type="number" min="0" max="10" value={value} onChange={(event) => updateTarget(setValue, event.target.value)} className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>)}</div><p className={cn("mt-2 text-xs", total > 10 ? "text-destructive" : "text-muted-foreground")}>{total}/10 new problems per active day</p></div><fieldset><legend className="text-sm font-medium">Active study days</legend><p className="mt-1 text-xs text-muted-foreground">Rest days pause new suggestions, not due reviews.</p><div className="mt-3 flex flex-wrap gap-2">{STUDY_WEEKDAYS.map((day) => <button type="button" aria-pressed={days.includes(day)} className={cn("min-h-10 rounded-md border px-3 text-sm font-medium", days.includes(day) ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-accent")} onClick={() => toggleDay(day)} key={day}>{weekdayLabels[day]}</button>)}</div></fieldset></div></section><section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Catalog</h2></div><div className="grid gap-2 p-4">{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <button type="button" onClick={() => setCatalog(id)} className={cn("min-h-14 rounded-md border px-3 text-left", catalog === id ? "border-primary bg-accent" : "border-border hover:bg-accent")} key={id}><span className="block text-sm font-medium">{info.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{info.description}</span></button>)}</div></section><section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Profile</h2></div><div className="grid gap-4 p-4 sm:grid-cols-2"><label className="text-sm font-medium">Display name<input value={name} minLength={2} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" required /></label><label className="text-sm font-medium">Timezone<select value={zone} onChange={(event) => setZone(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{zones.map((value) => <option key={value}>{value}</option>)}</select></label></div></section><div className="flex flex-wrap items-center gap-3"><Button disabled={pending || total > 10 || days.length === 0}><Save size={16} /> {pending ? "Saving…" : "Save changes"}</Button>{message && <p className={cn("flex items-center gap-1.5 text-sm", message === "Settings saved." ? "text-emerald-600 dark:text-emerald-300" : "text-destructive")}><Check size={16} /> {message}</p>}</div></form>;
}
