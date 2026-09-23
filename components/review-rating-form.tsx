"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckCircle2, Clock3, LoaderCircle, NotebookPen } from "lucide-react";
import { submitReview, type ReviewActionResult } from "@/lib/actions";
import type { PatternRecall, RatingOption } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function ReviewRatingForm({ problemId, options, onComplete }: { problemId: string; options: RatingOption[]; onComplete?: (result: Extract<ReviewActionResult, { ok: true }>) => void }) {
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState("");
  const [patternRecall, setPatternRecall] = useState<PatternRecall | undefined>();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [completion, setCompletion] = useState<Extract<ReviewActionResult, { ok: true }> | null>(null);

  const submit = useCallback((rating: RatingOption["rating"]) => {
    const durationMinutes = minutes ? Number(minutes) : undefined;
    setMessage(null);
    startTransition(async () => {
      const result = await submitReview({ problemId, rating, note, durationMinutes, patternRecall, requestId: crypto.randomUUID() });
      if (!result.ok) return setMessage(result.error);
      setCompletion(result);
      setNote("");
      setMinutes("");
      setPatternRecall(undefined);
      window.setTimeout(() => onComplete?.(result), 1500);
    });
  }, [minutes, note, onComplete, patternRecall, problemId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const element = event.target as HTMLElement | null;
      if (pending || completion || element?.matches("input, textarea, select")) return;
      const rating = options.find((option) => option.rating === ({ "1": "again", "2": "hard", "3": "good", "4": "easy" }[event.key]));
      if (rating) {
        event.preventDefault();
        submit(rating.rating);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completion, options, pending, submit]);

  if (completion) return <div className="review-confirmation" role="status"><CheckCircle2 size={25} /><strong>Review completed</strong><p>Interval: {completion.previousIntervalDays || "new"} → {completion.newIntervalDays} days</p><p>Next review: {formatDate(completion.nextDue)}</p><p>Estimated recall: {completion.previousRetrievability == null ? "—" : `${Math.round(completion.previousRetrievability * 100)}%`} → {Math.round(completion.newRetrievability * 100)}%</p></div>;

  return <div className="review-form">
    <div className="rating-grid" aria-label="How well did you recall this problem?">
      {options.map((option) => <button className={`rating-button rating-${option.rating}`} type="button" key={option.rating} onClick={() => submit(option.rating)} disabled={pending}>
        <span><strong>{option.label}</strong><small>{option.detail}</small></span><em>{option.intervalLabel}</em><kbd>{option.rating === "again" ? "1" : option.rating === "hard" ? "2" : option.rating === "good" ? "3" : "4"}</kbd>
      </button>)}
    </div>
    <div className="review-detail-grid">
      <label className="field-label"><span><Clock3 size={14} /> Time spent <i>optional</i></span><input type="number" min="1" max="300" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="Minutes" /></label>
      <fieldset className="pattern-recall-field"><legend>Remembered the pattern? <i>optional</i></legend><div>{(["no", "partial", "yes"] as PatternRecall[]).map((value) => <button type="button" key={value} className={patternRecall === value ? "selected" : ""} onClick={() => setPatternRecall(value)}>{value === "no" ? "No" : value === "partial" ? "Partially" : "Yes"}</button>)}</div></fieldset>
    </div>
    <label className="field-label note-field"><span><NotebookPen size={14} /> Private note <i>optional</i></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="What tripped you up? What should future-you remember?" rows={2} /></label>
    {pending && <p className="saving-message"><LoaderCircle size={16} className="spin" /> Saving review…</p>}
    {message && <p className="form-error" role="alert">{message}</p>}
  </div>;
}
