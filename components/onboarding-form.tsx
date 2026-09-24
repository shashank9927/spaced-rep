"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { CATALOGS } from "@/lib/constants";
import { saveOnboarding } from "@/lib/actions";
import { STUDY_WEEKDAYS, type CatalogId, type StudyWeekday } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const labels: Record<StudyWeekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(suggestedName);
  const [catalog, setCatalog] = useState<CatalogId>("neetcode150");
  const [easy, setEasy] = useState(0); const [medium, setMedium] = useState(0); const [hard, setHard] = useState(0);
  const [days, setDays] = useState<StudyWeekday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const total = easy + medium + hard;
  const change = (set: (value: number) => void, raw: string) => set(Math.max(0, Math.min(10, Number(raw) || 0)));
  const submit = (event: React.FormEvent) => { event.preventDefault(); setError(null); startTransition(async () => { const result = await saveOnboarding({ displayName: name, timezone: timeZone, selectedCatalog: catalog, studyPlan: { easyPerDay: easy, mediumPerDay: medium, hardPerDay: hard, studyDays: days } }); if (!result.ok) { setError(result.error); return; } router.push("/today"); }); };
  return <form onSubmit={submit} className="mt-7 space-y-6"><label className="block text-sm font-medium">What should we call you?<input autoFocus value={name} minLength={2} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" required /></label><fieldset><legend className="text-sm font-medium">Start with a catalog</legend><div className="mt-2 grid gap-2">{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <button type="button" onClick={() => setCatalog(id)} className={cn("flex min-h-14 items-center gap-3 rounded-md border p-3 text-left", catalog === id ? "border-primary bg-accent" : "border-border hover:bg-accent")} key={id}><span className="grid size-5 place-items-center rounded-full border border-border">{catalog === id && <Check size={13} />}</span><span><strong className="block text-sm">{info.name}</strong><small className="block text-xs text-muted-foreground">{info.description}</small></span></button>)}</div></fieldset><fieldset><legend className="text-sm font-medium">Choose your new-problem workload</legend><p className="mt-1 text-xs text-muted-foreground">There is no preset. Pick a pace you will actually sustain. Due reviews are always added on top.</p><div className="mt-3 grid grid-cols-3 gap-2">{([ ["Easy", easy, setEasy], ["Medium", medium, setMedium], ["Hard", hard, setHard] ] as const).map(([label, value, setValue]) => <label className="rounded-md border border-border p-2.5 text-sm" key={label}><span className="font-medium">{label}</span><input aria-label={`${label} new problems per day`} type="number" min="0" max="10" value={value} onChange={(event) => change(setValue, event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>)}</div><p className={cn("mt-2 text-xs", total < 1 || total > 10 ? "text-destructive" : "text-muted-foreground")}>{total}/10 new problems per active day</p></fieldset><fieldset><legend className="text-sm font-medium">Which days do you study?</legend><div className="mt-3 flex flex-wrap gap-2">{STUDY_WEEKDAYS.map((day) => <button type="button" aria-pressed={days.includes(day)} onClick={() => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} className={cn("min-h-10 rounded-md border px-3 text-sm", days.includes(day) ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-accent")} key={day}>{labels[day]}</button>)}</div></fieldset><p className="text-xs text-muted-foreground">Your local day uses {timeZone}. You can change this later in Settings.</p>{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button className="w-full" disabled={pending || total < 1 || total > 10 || days.length === 0}>{pending ? "Saving…" : <>Build my queue <ArrowRight size={16} /></>}</Button></form>;
}
