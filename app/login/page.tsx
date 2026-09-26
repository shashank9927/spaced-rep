import { Code2, LockKeyhole, RotateCcw } from "lucide-react";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { ThemeToggle } from "@/components/theme-toggle";

async function LoginContent({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  return <main className="grid min-h-dvh place-items-center bg-background px-4 py-16 text-foreground"><ThemeToggle /><section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"><div className="flex items-center gap-2.5 text-sm font-semibold"><span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Code2 size={18} /></span><span>RecallCode</span></div><div className="my-8"><span className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground"><RotateCcw size={13} /> Spaced repetition for problem solvers</span><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Remember the patterns, not just the answer.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Keep the interview problems you have solved fresh enough to solve them again.</p></div><GoogleSignIn />{message && <p className="mt-3 flex items-center gap-2 text-sm text-destructive" role="alert"><LockKeyhole size={16} /> {message}</p>}<p className="mt-6 flex gap-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground"><Code2 size={15} className="mt-0.5 shrink-0" /> Invite-only for your study group. Your notes and review history stay private.</p></section></main>;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) { return <Suspense fallback={null}><LoginContent searchParams={searchParams} /></Suspense>; }
