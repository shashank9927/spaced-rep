"use client";

import { useState, useTransition } from "react";
import { Check, Save } from "lucide-react";
import { saveSettings } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import type { CatalogId } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SettingsForm({ displayName, timezone, selectedCatalog }: { displayName: string; timezone: string; selectedCatalog: CatalogId }) {
  const [name, setName] = useState(displayName);
  const [zone, setZone] = useState(timezone);
  const [catalog, setCatalog] = useState<CatalogId>(selectedCatalog);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
  const save = () => startTransition(async () => {
    setMessage(null);
    const settings = await saveSettings({ displayName: name, timezone: zone, selectedCatalog: catalog });
    if (!settings.ok) { setMessage(settings.error); return; }
    if (catalog !== selectedCatalog) window.dispatchEvent(new CustomEvent("recallcode:catalog-changed", { detail: catalog }));
    setMessage("Settings saved.");
  });
  return <form className="mx-auto max-w-2xl space-y-5" onSubmit={(event) => { event.preventDefault(); save(); }}><header><p className="mb-1 text-sm text-muted-foreground">Account preferences</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Your catalog helps you browse. New problems are always chosen manually; ratings create future reviews.</p></header><section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Catalog</h2></div><div className="grid gap-2 p-4">{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <button type="button" onClick={() => setCatalog(id)} className={cn("min-h-14 rounded-md border px-3 text-left", catalog === id ? "border-primary bg-accent" : "border-border hover:bg-accent")} key={id}><span className="block text-sm font-medium">{info.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{info.description}</span></button>)}</div></section><section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Profile</h2></div><div className="grid gap-4 p-4 sm:grid-cols-2"><label className="text-sm font-medium">Display name<input value={name} minLength={2} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" required /></label><label className="text-sm font-medium">Timezone<select value={zone} onChange={(event) => setZone(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{zones.map((value) => <option key={value}>{value}</option>)}</select></label></div></section><div className="flex flex-wrap items-center gap-3"><Button disabled={pending}><Save size={16} /> {pending ? "Saving…" : "Save changes"}</Button>{message && <p className={cn("flex items-center gap-1.5 text-sm", message === "Settings saved." ? "text-emerald-600 dark:text-emerald-300" : "text-destructive")}><Check size={16} /> {message}</p>}</div></form>;
}
