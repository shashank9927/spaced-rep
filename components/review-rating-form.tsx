"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, LoaderCircle, NotebookPen } from "lucide-react";
import { submitReview, type ReviewActionResult, type ReviewConflictFailure } from "@/lib/actions";
import type { RatingOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const shortcuts: Record<string, RatingOption["rating"]> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };

export function ReviewRatingForm({ problemId, options, onComplete, onConflict }: { problemId: string; options: RatingOption[]; onComplete?: (result: Extract<ReviewActionResult, { ok: true }>) => void; onConflict?: (result: ReviewConflictFailure) => void }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const requestIdRef = useRef<{ fingerprint: string; id: string } | null>(null);

  const submit = useCallback((rating: RatingOption["rating"]) => {
    setMessage(null);
    const normalizedNote = note.trim();
    const fingerprint = JSON.stringify([problemId.toLowerCase(), rating, normalizedNote]);
    if (requestIdRef.current?.fingerprint !== fingerprint) requestIdRef.current = { fingerprint, id: crypto.randomUUID() };
    const requestId = requestIdRef.current.id;
    startTransition(async () => {
      const result = await submitReview({ problemId, rating, note: normalizedNote || undefined, requestId });
      if (!result.ok) {
        setMessage(result.error);
        if (result.code === "conflict" && "latestCard" in result) onConflict?.(result as ReviewConflictFailure);
        if (result.code === "conflict" || result.code === "invalid_input") requestIdRef.current = null;
        return;
      }
      requestIdRef.current = null;
      setNote("");
      onComplete?.(result);
    });
  }, [note, onComplete, onConflict, problemId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (pending || target?.matches("input, textarea, select")) return;
      const rating = shortcuts[event.key];
      if (rating && options.some((option) => option.rating === rating)) { event.preventDefault(); submit(rating); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options, pending, submit]);

  return <div className="space-y-3">
    <p className="text-sm leading-6 text-muted-foreground">Attempt first. If you could not reconstruct the approach, study the solution, then rate what you independently recalled.</p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="How well did you recall this problem?">{options.map((option, index) => <button type="button" key={option.rating} disabled={pending} onClick={() => submit(option.rating)} className={cn("relative flex min-h-32 flex-col rounded-lg border p-3 pr-10 text-left transition-[background-color,border-color,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:translate-y-0 disabled:opacity-60", option.rating === "again" && "border-destructive/25 bg-destructive/5 hover:bg-destructive/10", option.rating === "hard" && "border-warning/25 bg-warning/5 hover:bg-warning/10", option.rating === "good" && "border-success/25 bg-success/5 hover:bg-success/10", option.rating === "easy" && "border-info/25 bg-info/5 hover:bg-info/10")}><span className="block text-sm font-semibold">{option.label}</span><span className="mt-2 block flex-1 text-xs leading-5 text-muted-foreground">{option.detail}</span><span className="mt-4 block font-mono text-[10px] font-medium leading-4 text-muted-foreground">Approx. next review · {option.intervalLabel}</span><kbd className="absolute right-3 top-3 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{index + 1}</kbd></button>)}</div>
    <div className="rounded-lg border border-border bg-muted/40"><button type="button" className="flex min-h-10 w-full items-center justify-between px-3 text-sm text-muted-foreground hover:text-foreground" onClick={() => setNoteOpen((value) => !value)} aria-expanded={noteOpen}><span className="flex items-center gap-2"><NotebookPen size={15} /> Add a private note <span className="text-xs">optional</span></span><ChevronDown size={16} className={cn("transition-transform", noteOpen && "rotate-180")} /></button>{noteOpen && <Textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="What should future-you remember?" rows={3} className="mb-3 ml-3 w-[calc(100%-1.5rem)]" />}</div>
    {pending && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={15} className="animate-spin" /> Saving review…</p>}
    {message && <p className="text-sm text-destructive" role="alert">{message}</p>}
  </div>;
}
