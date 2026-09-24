"use client";

import { useState, useTransition } from "react";
import { CalendarDays, CheckCircle2, Save } from "lucide-react";
import { saveSettings, saveStudyPlanPreferences } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import { STUDY_WEEKDAYS, type CatalogId, type StudyPlanPreferences, type StudyWeekday } from "@/lib/types";

const WEEKDAY_LABELS: Record<StudyWeekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export function SettingsForm({ displayName, timezone, selectedCatalog, studyPlan }: { displayName: string; timezone: string; selectedCatalog: CatalogId; studyPlan: StudyPlanPreferences }) {
  const [name, setName] = useState(displayName);
  const [zone, setZone] = useState(timezone);
  const [catalog, setCatalog] = useState<CatalogId>(selectedCatalog);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const supportedZones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
  const [easyPerDay, setEasyPerDay] = useState(studyPlan.easyPerDay);
  const [mediumPerDay, setMediumPerDay] = useState(studyPlan.mediumPerDay);
  const [hardPerDay, setHardPerDay] = useState(studyPlan.hardPerDay);
  const [studyDays, setStudyDays] = useState<StudyWeekday[]>(studyPlan.studyDays);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [planPending, startPlanTransition] = useTransition();
  const total = easyPerDay + mediumPerDay + hardPerDay;
  function toggleDay(day: StudyWeekday) {
    setStudyDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  }
  return <div className="settings-stack"><form className="settings-form" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await saveSettings({ displayName: name, timezone: zone, selectedCatalog: catalog }); if (result.ok && catalog !== selectedCatalog) window.dispatchEvent(new Event("recallcode:catalog-changed")); setMessage(result.ok ? result.message ?? "Settings saved." : result.error); }); }}>
    <label className="field-label light-field">Display name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required /></label>
    <label className="field-label light-field">Timezone<select value={zone} onChange={(event) => setZone(event.target.value)}>{supportedZones.map((value) => <option key={value}>{value}</option>)}</select><small>Dates and streaks use this timezone.</small></label>
    <fieldset className="settings-catalog"><legend>Study list</legend>{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <button type="button" onClick={() => setCatalog(id)} className={catalog === id ? "selected" : ""} key={id}><strong>{info.name}</strong><small>{info.description}</small></button>)}</fieldset>
    <button className="primary-button" disabled={pending}><Save size={17} />{pending ? "Saving…" : "Save settings"}</button>{message && <p className={message === "Settings saved." ? "success-message" : "form-error"}><CheckCircle2 size={16} /> {message}</p>}
  </form>
  <form className="settings-form study-plan-form" onSubmit={(event) => { event.preventDefault(); startPlanTransition(async () => { const result = await saveStudyPlanPreferences({ easyPerDay, mediumPerDay, hardPerDay, studyDays }); setPlanMessage(result.ok ? result.message ?? "Study plan saved." : result.error); }); }}>
    <div className="section-title"><span><CalendarDays size={20} /> New-problem plan</span></div>
    <p className="subtle-copy">Due reviews are always shown. These targets only decide how many new problems appear on your active study days.</p>
    <div className="daily-target-grid">
      {([ ["Easy", easyPerDay, setEasyPerDay], ["Medium", mediumPerDay, setMediumPerDay], ["Hard", hardPerDay, setHardPerDay] ] as const).map(([label, value, setValue]) => <label className="field-label light-field" key={label}>{label} per active day<input type="number" min="0" max="10" value={value} onChange={(event) => setValue(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} /></label>)}
    </div>
    <p className={total > 10 ? "form-error" : "subtle-copy"}>Daily total: {total}/10</p>
    <fieldset className="study-days"><legend>Study days</legend><div>{STUDY_WEEKDAYS.map((day) => <button type="button" className={studyDays.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)} key={day} aria-pressed={studyDays.includes(day)}>{WEEKDAY_LABELS[day]}</button>)}</div></fieldset>
    <button className="primary-button" disabled={planPending || total > 10 || studyDays.length === 0}><Save size={17} />{planPending ? "Saving…" : "Save study plan"}</button>{planMessage && <p className={planMessage === "Study plan saved." ? "success-message" : "form-error"}><CheckCircle2 size={16} /> {planMessage}</p>}
  </form></div>;
}
