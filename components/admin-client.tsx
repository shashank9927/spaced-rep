"use client";

import { useState, useTransition } from "react";
import { MailPlus, PauseCircle, PlayCircle } from "lucide-react";
import { inviteUser, setUserAccess } from "@/lib/actions";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return <form className="invite-form" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await inviteUser(email); setMessage(result.ok ? result.message ?? "Invite saved." : result.error); if (result.ok) setEmail(""); }); }}>
    <label className="field-label">Invite a friend<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" required /></label>
    <button className="primary-button" disabled={pending}><MailPlus size={17} /> {pending ? "Saving…" : "Allow access"}</button>
    {message && <p className={message.includes("can now") ? "success-message" : "form-error"}>{message}</p>}
  </form>;
}

export function AccessToggle({ email, active }: { email: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return <button className="text-button access-toggle" disabled={pending} onClick={() => startTransition(async () => { await setUserAccess(email, !active); })}>{active ? <><PauseCircle size={16} /> Disable</> : <><PlayCircle size={16} /> Restore</>}</button>;
}
