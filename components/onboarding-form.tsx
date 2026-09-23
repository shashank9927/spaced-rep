"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { CATALOGS } from "@/lib/constants";
import { saveOnboarding } from "@/lib/actions";
import type { CatalogId } from "@/lib/types";

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(suggestedName);
  const [catalog, setCatalog] = useState<CatalogId>("neetcode150");
  const [error, setError] = useState<string | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveOnboarding({ displayName: name, timezone: timeZone, selectedCatalog: catalog });
      if (!result.ok) return setError(result.error);
      router.push("/dashboard");
      router.refresh();
    });
  }
  return <form onSubmit={submit} className="onboarding-form">
    <label className="field-label">What should we call you?
      <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoFocus />
    </label>
    <fieldset className="catalog-choice"><legend>Start with a study list</legend>
      {(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, info]) => (
        <button type="button" onClick={() => setCatalog(id)} className={catalog === id ? "choice-card selected" : "choice-card"} key={id}>
          <span className="choice-check">{catalog === id && <Check size={15} />}</span>
          <span><strong>{info.name}</strong><small>{info.description}</small></span>
        </button>
      ))}
    </fieldset>
    <p className="subtle-copy">Your device timezone is set to {timeZone}. It keeps streaks and dates consistent for you.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button large-button" disabled={pending}>{pending ? "Saving…" : <>Build my queue <ChevronRight size={18} /></>}</button>
  </form>;
}
