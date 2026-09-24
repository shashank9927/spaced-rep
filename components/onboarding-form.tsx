"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { CATALOGS } from "@/lib/constants";
import { saveOnboarding } from "@/lib/actions";
import { STUDY_WEEKDAYS, type CatalogId, type StudyWeekday } from "@/lib/types";

const WEEKDAY_LABELS: Record<StudyWeekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(suggestedName);
  const [catalog, setCatalog] = useState<CatalogId>("neetcode150");
  const [easyPerDay, setEasyPerDay] = useState(1);
  const [mediumPerDay, setMediumPerDay] = useState(1);
  const [hardPerDay, setHardPerDay] = useState(0);
  const [studyDays, setStudyDays] = useState<StudyWeekday[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [error, setError] = useState<string | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveOnboarding({ displayName: name, timezone: timeZone, selectedCatalog: catalog, studyPlan: { easyPerDay, mediumPerDay, hardPerDay, studyDays } });
      if (!result.ok) return setError(result.error);
      router.push("/dashboard");
    });
  }
  return <form onSubmit={submit} className="onboarding-form">
    <label className="field-label">What should we call you?
      <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoFocus />
    </label>
    <fieldset className="catalog-choice"><legend>Start with a study list</legend>
      {(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => (
        <button type="button" onClick={() => setCatalog(id)} className={catalog === id ? "choice-card selected" : "choice-card"} key={id}>
          <span className="choice-check">{catalog === id && <Check size={15} />}</span>
          <span><strong>{info.name}</strong><small>{info.description}</small></span>
        </button>
      ))}
    </fieldset>
    <fieldset className="onboarding-plan"><legend>Set a realistic new-problem plan</legend><p>Reviews are never capped. This only schedules fresh problems on your study days.</p><div className="daily-target-grid">{([ ["Easy", easyPerDay, setEasyPerDay], ["Medium", mediumPerDay, setMediumPerDay], ["Hard", hardPerDay, setHardPerDay] ] as const).map(([label, value, setValue]) => <label className="field-label" key={label}>{label} per day<input type="number" min="0" max="10" value={value} onChange={(event) => setValue(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} /></label>)}</div><p className={easyPerDay + mediumPerDay + hardPerDay > 10 ? "form-error" : "subtle-copy"}>Daily total: {easyPerDay + mediumPerDay + hardPerDay}/10</p><div className="study-days" role="group" aria-label="Study days">{STUDY_WEEKDAYS.map((day) => <button type="button" className={studyDays.includes(day) ? "selected" : ""} onClick={() => setStudyDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} aria-pressed={studyDays.includes(day)} key={day}>{WEEKDAY_LABELS[day]}</button>)}</div></fieldset>
    <p className="subtle-copy">Your device timezone is set to {timeZone}. It keeps streaks and dates consistent for you.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button large-button" disabled={pending || easyPerDay + mediumPerDay + hardPerDay > 10 || studyDays.length === 0}>{pending ? "Saving…" : <>Build my queue <ChevronRight size={18} /></>}</button>
  </form>;
}
