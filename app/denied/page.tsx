import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DeniedPage() {
  return <main className="auth-page"><ThemeToggle /><section className="auth-card denied-card"><LockKeyhole size={32} /><span className="eyebrow">Access needed</span><h1>This account is not invited yet.</h1><p>Ask the person who shared Recall Code with you to add this Google email address.</p><Link className="outline-button" href="/login">Try a different account</Link></section></main>;
}
