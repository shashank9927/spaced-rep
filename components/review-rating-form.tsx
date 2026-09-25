"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, LoaderCircle, NotebookPen } from "lucide-react";
import { submitReview, type ReviewActionResult } from "@/lib/actions";
import type { RatingOption } from "@/lib/types";
import { cn } from "@/lib/utils";

const shortcuts: Record<string, RatingOption["rating"]> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };

export function ReviewRatingForm({ problemId, options, onComplete }: { problemId: string; options: RatingOption[]; onComplete?: (result: Extract<ReviewActionResult, { ok: true }>) => void }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const submit = useCallback((rating: RatingOption["rating"]) => {
    setMessage(null);
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    startTransition(async () => {
      const result = await submitReview({ problemId, rating, note: note || undefined, requestId });
      if (!result.ok) { setMessage(result.error); return; }
      requestIdRef.current = null;
      setNote("");
      onComplete?.(result);
    });
  }, [note, onComplete, problemId]);

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
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="How well did you recall this problem?">{options.map((option, index) => <button type="button" key={option.rating} disabled={pending} onClick={() => submit(option.rating)} className={cn("relative min-h-32 rounded-lg border p-3 text-left transition-[background-color,border-color,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:translate-y-0 disabled:opacity-60", option.rating === "again" && "border-destructive/25 bg-destructive/5 hover:bg-destructive/10", option.rating === "hard" && "border-warning/25 bg-warning/5 hover:bg-warning/10", option.rating === "good" && "border-success/25 bg-success/5 hover:bg-success/10", option.rating === "easy" && "border-info/25 bg-info/5 hover:bg-info/10")}><span className="block pr-6 text-sm font-semibold">{option.label}</span><span className="mt-2 block text-xs leading-5 text-muted-foreground">{option.detail}</span><span className="absolute bottom-3 left-3 block font-mono text-[10px] font-medium text-muted-foreground">Next: {option.intervalLabel}</span><kbd className="absolute right-3 top-3 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{index + 1}</kbd></button>)}</div>
    <div className="rounded-lg border border-border bg-muted/40"><button type="button" className="flex min-h-10 w-full items-center justify-between px-3 text-sm text-muted-foreground hover:text-foreground" onClick={() => setNoteOpen((value) => !value)}><span className="flex items-center gap-2"><NotebookPen size={15} /> Add a private note <span className="text-xs">optional</span></span><ChevronDown size={16} className={cn("transition-transform", noteOpen && "rotate-180")} /></button>{noteOpen && <textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="What should future-you remember?" rows={3} className="mb-3 ml-3 w-[calc(100%-1.5rem)] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />}</div>
    {pending && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={15} className="animate-spin" /> Saving review…</p>}
    {message && <p className="text-sm text-destructive" role="alert">{message}</p>}
  </div>;
}
