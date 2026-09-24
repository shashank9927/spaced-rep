"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { CATALOGS } from "@/lib/constants";
import { saveOnboarding } from "@/lib/actions";
import type { CatalogId } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(suggestedName);
  const [catalog, setCatalog] = useState<CatalogId>("neetcode150");
  const [error, setError] = useState<string | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const submit = (event: React.FormEvent) => { event.preventDefault(); setError(null); startTransition(async () => { const result = await saveOnboarding({ displayName: name, timezone: timeZone, selectedCatalog: catalog }); if (!result.ok) { setError(result.error); return; } router.push("/today"); }); };

  return <form onSubmit={submit} className="mt-7 space-y-6"><label className="block text-sm font-medium">What should we call you?<input autoFocus value={name} minLength={2} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" required /></label><fieldset><legend className="text-sm font-medium">Start with a catalog</legend><p className="mt-1 text-xs text-muted-foreground">This only controls browsing. You choose when to attempt a problem.</p><div className="mt-3 grid gap-2">{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <button type="button" onClick={() => setCatalog(id)} className={cn("flex min-h-14 items-center gap-3 rounded-md border p-3 text-left", catalog === id ? "border-primary bg-accent" : "border-border hover:bg-accent")} key={id}><span className="grid size-5 place-items-center rounded-full border border-border">{catalog === id && <Check size={13} />}</span><span><strong className="block text-sm">{info.name}</strong><small className="block text-xs text-muted-foreground">{info.description}</small></span></button>)}</div></fieldset><section className="rounded-md border border-border bg-muted/35 p-3 text-sm text-muted-foreground"><strong className="block text-foreground">How RecallCode works</strong><p className="mt-1">Solve on NeetCode or LeetCode, then record how well you recalled the approach. Your rating starts a card and sets its next review date. Opening a problem never adds it to your queue.</p></section><p className="text-xs text-muted-foreground">Your local day uses {timeZone}. You can change this later in Settings.</p>{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button className="w-full" disabled={pending}>{pending ? "Saving…" : <>Start practicing <ArrowRight size={16} /></>}</Button></form>;
}
