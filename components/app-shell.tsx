"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenText, Code2, Flame, LayoutDashboard, Search, Settings, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { searchCatalog } from "@/lib/actions";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: BookOpenText },
  { href: "/patterns", label: "Patterns", icon: Code2 },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];

type ShellProfile = { display_name: string; email: string; role: string };

export function AppShell({ children, profile, streak }: { children: React.ReactNode; profile: ShellProfile; streak?: number }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ type: "problem" | "pattern"; title: string; subtitle: string; href: string }>>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onSearch(value: string) {
    setQuery(value);
    if (!value.trim()) return setResults([]);
    startTransition(async () => setResults(await searchCatalog(value)));
  }

  const initials = profile.display_name.slice(0, 1).toUpperCase();
  return <div className="app-frame light-app">
    <aside className="app-sidebar">
      <Link href="/dashboard" className="brand" aria-label="RecallCode home"><span className="brand-mark"><Code2 size={20} /></span><span>RecallCode</span></Link>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map(({ href, label, icon: Icon }) => <Link className={cn("sidebar-link", pathname === href && "is-active")} href={href} key={href}><Icon size={20} />{label}</Link>)}
      </nav>
      <div className="sidebar-footer">
        <Link href="/progress" className="streak-card"><span className="streak-icon"><Flame size={24} /></span><span><strong>{streak ?? "—"} day streak</strong><small>Keep it going!</small></span></Link>
        <Link href="/settings" className={cn("sidebar-link sidebar-settings", pathname === "/settings" && "is-active")}><Settings size={20} />Settings</Link>
        {profile.role === "admin" && <Link href="/admin" className={cn("sidebar-link sidebar-admin", pathname === "/admin" && "is-active")}><ShieldCheck size={20} />Admin</Link>}
        <div className="sidebar-account"><span className="avatar">{initials}</span><span><strong>{profile.display_name}</strong><small>{profile.email}</small></span><a href="/auth/signout">Sign out</a></div>
      </div>
    </aside>
    <div className="app-main">
      <header className="mobile-header"><Link href="/dashboard" className="brand"><span className="brand-mark"><Code2 size={18} /></span><span>RecallCode</span></Link><button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search problems and patterns"><Search size={19} /></button></header>
      <main className="main-content">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Main navigation">
      {navigation.map(({ href, label, icon: Icon }) => <Link className={cn("mobile-nav-link", pathname === href && "is-active")} href={href} key={href}><Icon size={19} /><span>{label}</span></Link>)}
      <Link className={cn("mobile-nav-link", pathname === "/settings" && "is-active")} href="/settings"><Settings size={19} /><span>Settings</span></Link>
    </nav>
    {searchOpen && <div className="search-dialog-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search problems and patterns" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-dialog-input"><Search size={20} /><input autoFocus value={query} onChange={(event) => onSearch(event.target.value)} placeholder="Search problems, patterns…" /><kbd>Esc</kbd><button aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={18} /></button></div>
        <div className="search-results">{pending && <p>Searching…</p>}{!pending && query && results.length === 0 && <p>No matching problems or patterns.</p>}{results.map((result) => <Link href={result.href} key={`${result.type}-${result.href}`} onClick={() => { setSearchOpen(false); setQuery(""); }}><span>{result.type === "problem" ? "Problem" : "Pattern"}</span><strong>{result.title}</strong><small>{result.subtitle}</small></Link>)}</div>
      </section>
    </div>}
  </div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state"><Code2 size={28} /><h2>{title}</h2><p>{body}</p>{action}</div>;
}
