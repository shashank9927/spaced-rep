"use client";

import { useState, useTransition } from "react";
import { MailPlus, PauseCircle, PlayCircle } from "lucide-react";
import { inviteUser, setUserAccess } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function InviteForm() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  return <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await inviteUser(email); setMessage(result.ok ? result.message ?? "Invite saved." : result.error); if (result.ok) setEmail(""); }); }}><input className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" required /><Button disabled={pending}><MailPlus size={16} /> {pending ? "Saving…" : "Allow access"}</Button>{message && <p className="basis-full text-sm text-muted-foreground">{message}</p>}</form>;
}

export function AccessToggle({ email, active }: { email: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return <Button size="sm" variant={active ? "outline" : "secondary"} disabled={pending} onClick={() => startTransition(async () => { await setUserAccess(email, !active); })}>{active ? <><PauseCircle size={14} /> Disable</> : <><PlayCircle size={14} /> Restore</>}</Button>;
}
