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
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const zones = Array.from(new Set([timeZone, ...(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [])]));
  const submit = (event: React.FormEvent) => { event.preventDefault(); setError(null); startTransition(async () => { const result = await saveOnboarding({ displayName: name, timezone: timeZone, selectedCatalog: catalog }); if (!result.ok) { setError(result.error); return; } router.push("/today"); }); };

  return <form onSubmit={submit} className="mt-7 space-y-6"><label className="block text-sm font-medium">What should we call you?<input autoFocus value={name} minLength={2} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" required /></label><label className="block text-sm font-medium">Your timezone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{zones.map((zone) => <option key={zone}>{zone}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Due dates are grouped by your local calendar day. Changing this later will not rewrite past reviews.</span></label><fieldset><legend className="text-sm font-medium">Browsing catalog</legend><p className="mt-1 text-xs text-muted-foreground">This only controls what you browse and search. Your existing cards always remain active.</p><div className="mt-3 grid gap-2">{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <button type="button" onClick={() => setCatalog(id)} className={cn("flex min-h-14 items-center gap-3 rounded-md border p-3 text-left", catalog === id ? "border-primary bg-accent" : "border-border hover:bg-accent")} key={id}><span className="grid size-5 place-items-center rounded-full border border-border">{catalog === id && <Check size={13} />}</span><span><strong className="block text-sm">{info.name}</strong><small className="block text-xs text-muted-foreground">{info.description}</small></span></button>)}</div></fieldset><section className="rounded-md border border-border bg-muted/35 p-4 text-sm"><strong className="block">How RecallCode works</strong><ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground"><li>Choose a problem and attempt it on NeetCode or LeetCode.</li><li>Record how well you independently recalled the approach.</li><li>Return when RecallCode marks it due; reviews appear in addition to any new problem you choose.</li></ol><p className="mt-3 text-xs leading-5 text-muted-foreground">Opening a problem never starts progress. If you needed meaningful hints or the solution, study it and record <strong className="text-foreground">Forgot</strong>.</p><div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2"><span><strong className="text-foreground">Forgot</strong> — couldn’t reconstruct independently or needed help.</span><span><strong className="text-foreground">Hard</strong> — recalled without hints, but with effort.</span><span><strong className="text-foreground">Good</strong> — solved independently with reasonable effort.</span><span><strong className="text-foreground">Easy</strong> — approach and implementation were clear.</span></div></section>{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button className="w-full" disabled={pending}>{pending ? "Saving…" : <>Start practicing <ArrowRight size={16} /></>}</Button></form>;
}
