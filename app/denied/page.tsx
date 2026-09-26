import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function DeniedPage() {
  return <main className="grid min-h-dvh place-items-center bg-background px-4 py-16 text-foreground"><ThemeToggle /><section className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm"><span className="mx-auto grid size-11 place-items-center rounded-md bg-destructive/10 text-destructive"><LockKeyhole size={22} /></span><p className="mt-5 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground">Access needed</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">This account is not invited yet.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Ask the person who shared RecallCode with you to add this Google email address.</p><Button className="mt-6" variant="outline" asChild><Link href="/login">Try a different account</Link></Button></section></main>;
}
