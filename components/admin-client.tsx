"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MailPlus, PauseCircle, PlayCircle, UsersRound } from "lucide-react";
import { inviteUser, setUserAccess, type AdminInviteRow } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

export function AdminAccessManager({ initialInvites, timezone }: { initialInvites: AdminInviteRow[]; timezone: string }) {
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [invitePending, startInviteTransition] = useTransition();
  const replaceInvite = (invite: AdminInviteRow) => setInvites((rows) => [invite, ...rows.filter((row) => row.email !== invite.email)].sort((a, b) => b.invited_at.localeCompare(a.invited_at)));

  return <>
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><MailPlus size={16} /> Add member</h2>
      <p className="mt-1 text-xs text-muted-foreground">Enter the Google email they will use to sign in.</p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap" onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startInviteTransition(async () => {
          const result = await inviteUser(email);
          const nextMessage = result.ok ? result.message : result.error;
          setMessage(nextMessage);
          if (!result.ok) { toast.error(nextMessage); return; }
          replaceInvite(result.invite);
          setEmail("");
          toast.success(nextMessage);
        });
      }}>
        <Input aria-label="Google email" className="min-w-0 flex-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" required />
        <Button disabled={invitePending}><MailPlus size={16} /> {invitePending ? "Saving…" : "Allow access"}</Button>
        {message && <p className="basis-full text-sm text-muted-foreground" role="status">{message}</p>}
      </form>
    </section>
    <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card md:col-span-2">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><UsersRound size={16} /> Allowed emails</h2><span className="text-xs text-muted-foreground">{invites.length}</span></div>
      {invites.length ? <div className="divide-y divide-border">{invites.map((invite) => <AccessRow invite={invite} timezone={timezone} onChange={replaceInvite} key={invite.email} />)}</div> : <p className="px-4 py-8 text-sm text-muted-foreground">Add your first friend above.</p>}
    </section>
  </>;
}

function AccessRow({ invite, timezone, onChange }: { invite: AdminInviteRow; timezone: string; onChange: (invite: AdminInviteRow) => void }) {
  const [pending, startTransition] = useTransition();
  const status = invite.is_active ? invite.claimed_at ? "Active" : "Waiting to sign in" : "Access disabled";
  return <div data-testid={`access-row-${invite.email}`} className="flex min-h-15 items-center gap-3 px-4 py-3">
    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{invite.email}</strong><small className="block text-xs text-muted-foreground">Added {formatDateTime(invite.invited_at, timezone)} · {status}</small></span>
    <Button size="sm" variant={invite.is_active ? "outline" : "secondary"} disabled={pending} onClick={() => {
      const previous = invite;
      const optimistic = { ...invite, is_active: !invite.is_active };
      onChange(optimistic);
      startTransition(async () => {
        const result = await setUserAccess(invite.email, optimistic.is_active);
        if (!result.ok) { onChange(previous); toast.error(result.error); return; }
        onChange(result.invite);
        toast.success(`${invite.email} access ${result.invite.is_active ? "restored" : "disabled"}.`);
      });
    }}>{pending ? <>Saving…</> : invite.is_active ? <><PauseCircle size={14} /> Disable</> : <><PlayCircle size={14} /> Restore</>}</Button>
  </div>;
}
