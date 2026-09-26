import { Database } from "lucide-react";
import { Suspense } from "react";
import { AdminAccessManager } from "@/components/admin-client";
import { RouteLoading } from "@/components/route-loading";
import { requireProfile } from "@/lib/auth";
import { getAdminData } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

async function AdminContent() {
  const profile = await requireProfile({ admin: true });
  const data = await getAdminData();
  return <section className="mx-auto max-w-3xl">
    <header className="mb-7"><p className="mb-1 text-sm text-muted-foreground">Owner controls</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Study group access</h1><p className="mt-2 text-sm text-muted-foreground">Only allowed emails can sign in. Members’ study data remains private.</p></header>
    <div className="grid gap-5 md:grid-cols-2">
      <AdminAccessManager initialInvites={data.invites} timezone={profile.timezone} />
      <section className="rounded-lg border border-border bg-card p-4 md:col-start-2 md:row-start-1"><h2 className="flex items-center gap-2 text-sm font-semibold"><Database size={16} /> Catalog snapshot</h2>{data.snapshots[0] ? <div className="mt-4 text-sm"><strong>{data.snapshots[0].problem_count} metadata records</strong><p className="mt-1 font-mono text-xs text-muted-foreground">{data.snapshots[0].version}</p><p className="mt-2 text-xs text-muted-foreground">Imported {formatDateTime(data.snapshots[0].imported_at, profile.timezone)}</p></div> : <p className="mt-4 text-sm text-muted-foreground">Run the catalog import script to seed the public metadata.</p>}</section>
    </div>
  </section>;
}

export default function AdminPage() { return <Suspense fallback={<RouteLoading variant="detail" />}><AdminContent /></Suspense>; }
