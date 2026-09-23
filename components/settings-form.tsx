"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { saveSettings } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import type { CatalogId } from "@/lib/types";

export function SettingsForm({ displayName, timezone, selectedCatalog }: { displayName: string; timezone: string; selectedCatalog: CatalogId }) {
  const [name, setName] = useState(displayName);
  const [zone, setZone] = useState(timezone);
  const [catalog, setCatalog] = useState<CatalogId>(selectedCatalog);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const supportedZones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
  return <form className="settings-form" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await saveSettings({ displayName: name, timezone: zone, selectedCatalog: catalog }); setMessage(result.ok ? result.message ?? "Settings saved." : result.error); }); }}>
    <label className="field-label light-field">Display name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required /></label>
    <label className="field-label light-field">Timezone<select value={zone} onChange={(event) => setZone(event.target.value)}>{supportedZones.map((value) => <option key={value}>{value}</option>)}</select><small>Dates and streaks use this timezone.</small></label>
    <fieldset className="settings-catalog"><legend>Study list</legend>{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <button type="button" onClick={() => setCatalog(id)} className={catalog === id ? "selected" : ""} key={id}><strong>{info.name}</strong><small>{info.description}</small></button>)}</fieldset>
    <button className="primary-button" disabled={pending}><Save size={17} />{pending ? "Saving…" : "Save settings"}</button>{message && <p className={message === "Settings saved." ? "success-message" : "form-error"}><CheckCircle2 size={16} /> {message}</p>}
  </form>;
}
