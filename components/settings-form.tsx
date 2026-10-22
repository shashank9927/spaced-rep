"use client";

import { timezoneOptions } from "@/lib/timezones";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { resetStudyProgress, saveSettings } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import type { CatalogId } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReviewUndo } from "@/components/review-undo-provider";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function SettingsForm({ displayName, timezone, selectedCatalog }: { displayName: string; timezone: string; selectedCatalog: CatalogId }) {
  const router = useRouter();
  const { clearUndo } = useReviewUndo();
  const [name, setName] = useState(displayName);
  const [zone, setZone] = useState(timezone);
  const [catalog, setCatalog] = useState<CatalogId>(selectedCatalog);
  const [message, setMessage] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resetPending, startResetTransition] = useTransition();
  const zones = timezoneOptions(timezone);

  const save = () => startTransition(async () => {
    setMessage(null);
    const settings = await saveSettings({ displayName: name, timezone: zone, selectedCatalog: catalog });
    if (!settings.ok) { setMessage(settings.error); return; }
    if (settings.profile.selected_catalog !== selectedCatalog) window.dispatchEvent(new CustomEvent("recallcode:catalog-changed", { detail: settings.profile.selected_catalog }));
    window.dispatchEvent(new CustomEvent("recallcode:profile-updated", { detail: settings.profile }));
    setMessage(settings.message);
  });

  const closeReset = (open: boolean) => {
    if (resetPending) return;
    setResetOpen(open);
    if (!open) { setConfirmation(""); setResetMessage(null); }
  };

  const reset = () => startResetTransition(async () => {
    setResetMessage(null);
    if (confirmation !== "RESET") { setResetMessage("Type RESET exactly to confirm."); return; }
    const result = await resetStudyProgress({ confirmation });
    if (!result.ok) { setResetMessage(result.error); return; }
    toast.dismiss();
    clearUndo();
    toast.success(result.message ?? "Study progress reset. Your account and catalog were kept.");
    setResetOpen(false);
    setConfirmation("");
    router.push("/today");
  });

  return <>
    <form className="mx-auto max-w-2xl space-y-5" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <header><p className="mb-1 text-sm text-muted-foreground">Account preferences</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Your catalog controls browsing and search only. Existing cards and review dates are shared across catalogs.</p></header>

      <section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Browsing catalog</h2><p className="mt-1 text-xs text-muted-foreground">Switching this changes the problem deck and search results—not your review queue.</p></div><div className="grid gap-2 p-4">{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => <button type="button" onClick={() => setCatalog(id)} className={cn("min-h-14 rounded-md border px-3 text-left", catalog === id ? "border-primary bg-accent" : "border-border hover:bg-accent")} key={id}><span className="block text-sm font-medium">{info.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{info.description}</span></button>)}</div></section>

      <section className="rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Profile</h2></div><div className="grid gap-4 p-4 sm:grid-cols-2"><label className="text-sm font-medium">Display name<Input className="mt-2" value={name} minLength={2} maxLength={60} onChange={(event) => setName(event.target.value)} required /></label><label className="text-sm font-medium">Timezone<Select className="mt-2" value={zone} onChange={(event) => setZone(event.target.value)}>{zones.map((value) => <option key={value}>{value}</option>)}</Select><span className="mt-1 block text-xs font-normal text-muted-foreground">Changes day grouping for future views. Existing FSRS timestamps are not rewritten.</span></label></div></section>

      <div className="flex flex-wrap items-center gap-3"><Button disabled={pending}><Save size={16} /> {pending ? "Saving…" : "Save changes"}</Button>{message && <p className={cn("flex items-center gap-1.5 text-sm", message === "Settings saved." ? "text-success" : "text-destructive")}><Check size={16} /> {message}</p>}</div>

      <section className="overflow-hidden rounded-lg border border-destructive/35 bg-destructive/5"><div className="border-b border-destructive/25 px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle size={16} />Danger zone</h2></div><div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-medium">Reset all study progress</h3><p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">Permanently remove your active cards, queue, ratings, notes, schedule activity, and undo history. Your account and catalog stay unchanged.</p></div><Button type="button" variant="destructive" className="shrink-0" onClick={() => setResetOpen(true)}><Trash2 size={16} />Reset progress</Button></div></section>
    </form>

    <Dialog.Root open={resetOpen} onOpenChange={closeReset}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4"><div><Dialog.Title className="flex items-center gap-2 text-base font-semibold"><AlertTriangle size={18} className="text-destructive" />Reset all study progress?</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">This cannot be undone. Every review, private note, FSRS card, scheduled review, and activity record will be permanently removed.</Dialog.Description></div><Dialog.Close asChild><Button type="button" variant="ghost" size="icon-sm" disabled={resetPending} aria-label="Close reset dialog"><X size={16} /></Button></Dialog.Close></div>
          <label className="mt-5 block text-sm font-medium">Type <span className="font-mono text-destructive">RESET</span> to continue<Input autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={resetPending} className="mt-2 font-mono" aria-describedby="reset-help" /></label>
          <p id="reset-help" className="mt-2 text-xs text-muted-foreground">Your display name, timezone, catalog selection, invitation, and Google sign-in will remain.</p>
          {resetMessage && <p className="mt-3 text-sm text-destructive" role="alert">{resetMessage}</p>}
          <div className="mt-5 flex justify-end gap-2"><Dialog.Close asChild><Button type="button" variant="outline" disabled={resetPending}>Cancel</Button></Dialog.Close><Button type="button" variant="destructive" disabled={resetPending || confirmation !== "RESET"} onClick={reset}>{resetPending ? "Resetting…" : "Permanently reset"}</Button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
