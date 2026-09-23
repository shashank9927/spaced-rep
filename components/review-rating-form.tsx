"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { submitReview } from "@/lib/actions";
import type { RatingOption } from "@/lib/types";

export function ReviewRatingForm({ problemId, options, onComplete }: { problemId: string; options: RatingOption[]; onComplete?: () => void }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function submit(rating: RatingOption["rating"]) {
    setMessage(null);
    startTransition(async () => {
      const result = await submitReview({ problemId, rating, note, requestId: crypto.randomUUID() });
      if (!result.ok) return setMessage(result.error);
      setMessage(`Saved. Next review ${result.nextDue ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(result.nextDue)) : "scheduled"}.`);
      setNote("");
      onComplete?.();
    });
  }
  return <div className="review-form">
    <label className="field-label">Private note <span>optional</span>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="What tripped you up? What pattern should future-you remember?" rows={3} />
    </label>
    <div className="rating-grid" aria-label="How well did you recall this problem?">
      {options.map((option) => <button className={`rating-button rating-${option.rating}`} type="button" key={option.rating} onClick={() => submit(option.rating)} disabled={pending}>
        <span><strong>{option.label}</strong><small>{option.detail}</small></span><em>{option.intervalLabel}</em>
      </button>)}
    </div>
    {pending && <p className="saving-message"><LoaderCircle size={16} className="spin" /> Saving review…</p>}
    {message && <p className={message.startsWith("Saved") ? "success-message" : "form-error"} role="status"><CheckCircle2 size={16} /> {message}</p>}
  </div>;
}
