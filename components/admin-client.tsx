"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MailPlus, PauseCircle, PlayCircle } from "lucide-react";
import { inviteUser, setUserAccess } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteForm() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  return <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" onSubmit={(event) => { event.preventDefault(); setMessage(null); startTransition(async () => { const result = await inviteUser(email); const nextMessage = result.ok ? result.message ?? "Invite saved." : result.error; setMessage(nextMessage); if (result.ok) { setEmail(""); toast.success(nextMessage); } else toast.error(nextMessage); }); }}><Input className="min-w-0 flex-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" required /><Button disabled={pending}><MailPlus size={16} /> {pending ? "Saving…" : "Allow access"}</Button>{message && <p className="basis-full text-sm text-muted-foreground" role="status">{message}</p>}</form>;
}

export function AccessToggle({ email, active }: { email: string; active: boolean }) {
  const [isActive, setIsActive] = useState(active);
  const [pending, startTransition] = useTransition();
  const nextActive = !isActive;
  return <Button size="sm" variant={isActive ? "outline" : "secondary"} disabled={pending} onClick={() => {
    const previous = isActive;
    setIsActive(nextActive);
    startTransition(async () => {
      const result = await setUserAccess(email, nextActive);
      if (!result.ok) {
        setIsActive(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`${email} access ${nextActive ? "restored" : "disabled"}.`);
    });
  }}>{isActive ? <><PauseCircle size={14} /> {pending ? "Disabling…" : "Disable"}</> : <><PlayCircle size={14} /> {pending ? "Restoring…" : "Restore"}</>}</Button>;
}
