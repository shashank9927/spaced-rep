"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenText, CalendarDays, Code2, LayoutDashboard, Moon, Search, Settings, ShieldCheck, Sun, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getSearchIndex } from "@/lib/actions";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: BookOpenText },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];

type ShellProfile = { display_name: string; email: string; role: string };
type Theme = "light" | "dark";

function ThemeButton({ theme, onToggle, compact = false }: { theme: Theme; onToggle: () => void; compact?: boolean }) {
  const nextLabel = theme === "dark" ? "light" : "dark";
  return <button className={cn("theme-toggle", compact && "theme-toggle-compact")} type="button" onClick={onToggle} aria-label={`Switch to ${nextLabel} mode`} title={`Switch to ${nextLabel} mode`}><span aria-hidden="true">{theme === "dark" ? <Sun size={compact ? 18 : 17} /> : <Moon size={compact ? 18 : 17} />}</span><span>{compact ? "" : theme === "dark" ? "Light mode" : "Dark mode"}</span></button>;
}

type SearchIndexItem = { type: "problem" | "pattern"; title: string; subtitle: string; href: string };

export function AppShell({ children, profile }: { children: React.ReactNode; profile: ShellProfile }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState<SearchIndexItem[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem("recallcode-theme");
    const nextTheme = stored === "dark" || stored === "light"
      ? stored
      : document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    window.setTimeout(() => setTheme(nextTheme), 0);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    function clearSearchIndex() {
      setSearchIndex(null);
      setQuery("");
    }
    window.addEventListener("recallcode:catalog-changed", clearSearchIndex);
    return () => window.removeEventListener("recallcode:catalog-changed", clearSearchIndex);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("recallcode-theme", nextTheme);
  }

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    if (searchIndex !== null) return;
    startTransition(async () => setSearchIndex(await getSearchIndex()));
  }, [searchIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || !searchIndex) return [];
    return searchIndex.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized)).slice(0, 12);
  }, [query, searchIndex]);

  const initials = profile.display_name.slice(0, 1).toUpperCase();
  return <div className="app-frame">
    <aside className="app-sidebar">
      <div className="sidebar-brand-row"><Link href="/dashboard" className="brand" aria-label="RecallCode home"><span className="brand-mark"><Code2 size={20} /></span><span>RecallCode</span></Link><ThemeButton theme={theme} onToggle={toggleTheme} compact /></div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map(({ href, label, icon: Icon }) => <Link className={cn("sidebar-link", pathname === href && "is-active")} href={href} key={href}><Icon size={20} />{label}</Link>)}
      </nav>
      <div className="sidebar-footer">
        <Link href="/settings" className={cn("sidebar-link sidebar-settings", pathname === "/settings" && "is-active")}><Settings size={20} />Settings</Link>
        {profile.role === "admin" && <Link href="/admin" className={cn("sidebar-link sidebar-admin", pathname === "/admin" && "is-active")}><ShieldCheck size={20} />Admin</Link>}
        <div className="sidebar-account"><span className="avatar">{initials}</span><span><strong>{profile.display_name}</strong><small>{profile.email}</small></span><a href="/auth/signout">Sign out</a></div>
      </div>
    </aside>
    <div className="app-main">
      <header className="desktop-header"><button className="desktop-search-trigger" onClick={openSearch} aria-label="Search problems and patterns"><Search size={18} /><span>Search problems, patterns…</span><kbd>Ctrl K</kbd></button></header>
      <header className="mobile-header"><Link href="/dashboard" className="brand"><span className="brand-mark"><Code2 size={18} /></span><span>RecallCode</span></Link><div className="mobile-header-actions"><ThemeButton theme={theme} onToggle={toggleTheme} compact /><button className="search-trigger" onClick={openSearch} aria-label="Search problems and patterns"><Search size={19} /></button></div></header>
      <main className="main-content">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Main navigation">
      {navigation.map(({ href, label, icon: Icon }) => <Link className={cn("mobile-nav-link", pathname === href && "is-active")} href={href} key={href}><Icon size={19} /><span>{label}</span></Link>)}
      <Link className={cn("mobile-nav-link", pathname === "/settings" && "is-active")} href="/settings"><Settings size={19} /><span>Settings</span></Link>
    </nav>
    {searchOpen && <div className="search-dialog-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search problems and patterns" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-dialog-input"><Search size={20} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search problems, patterns…" /><kbd>Esc</kbd><button aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={18} /></button></div>
        <div className="search-results">{pending && <p>Loading your catalog…</p>}{!pending && !query && <p>Start typing to search the selected catalog.</p>}{!pending && query && results.length === 0 && <p>No matching problems or patterns.</p>}{results.map((result) => <Link href={result.href} key={`${result.type}-${result.href}`} onClick={() => { setSearchOpen(false); setQuery(""); }}><span>{result.type === "problem" ? "Problem" : "Pattern"}</span><strong>{result.title}</strong><small>{result.subtitle}</small></Link>)}</div>
      </section>
    </div>}
  </div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state"><Code2 size={28} /><h2>{title}</h2><p>{body}</p>{action}</div>;
}
