import { Code2, LockKeyhole, RotateCcw } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  return <main className="auth-page"><div className="auth-grid-bg" /><section className="auth-card"><div className="auth-brand brand"><span className="brand-mark"><Code2 size={19} /></span><span>RecallCode</span></div><div className="auth-copy"><span className="eyebrow"><RotateCcw size={14} /> Spaced repetition for problem solvers</span><h1>Remember the patterns, not just the answer.</h1><p>Keep the interview problems you have solved fresh enough to solve them again.</p></div><GoogleSignIn />{message && <p className="form-error"><LockKeyhole size={16} /> {message}</p>}<p className="auth-footnote"><Code2 size={15} /> Invite-only for your study group. Your notes and review history stay private.</p></section></main>;
}
