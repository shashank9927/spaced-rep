"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenText, CalendarDays, Check, Code2, Command, LayoutDashboard, LogOut, Moon, Search, Settings, ShieldCheck, Sun, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Toaster } from "sonner";
import { getSearchIndex } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: BookOpenText },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];

type ShellProfile = { display_name: string; email: string; role: string };
type Theme = "light" | "dark";
type SearchIndexItem = { type: "problem" | "pattern"; title: string; subtitle: string; href: string };

function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" type="button" onClick={onToggle} aria-label={`Switch to ${next} mode`}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</Button></TooltipTrigger><TooltipContent>Switch to {next} mode</TooltipContent></Tooltip>;
}

function UserMenu({ profile, theme, onToggle, compact = false }: { profile: ShellProfile; theme: Theme; onToggle: () => void; compact?: boolean }) {
  const initials = profile.display_name.slice(0, 2).toUpperCase();
  return <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className={cn("flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring", compact && "justify-center px-0")} aria-label="Open account menu"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</span>{!compact && <span className="min-w-0 flex-1"><span className="block truncate font-medium">{profile.display_name}</span><span className="block truncate text-xs text-muted-foreground">{profile.email}</span></span>}</button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" side="top" className="z-50 min-w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"><DropdownMenu.Item asChild><Link className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-accent" href="/settings"><Settings size={16} /> Settings</Link></DropdownMenu.Item>{profile.role === "admin" && <DropdownMenu.Item asChild><Link className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-accent" href="/admin"><ShieldCheck size={16} /> Admin</Link></DropdownMenu.Item>}<DropdownMenu.Separator className="my-1 h-px bg-border" /><DropdownMenu.Item onSelect={(event) => { event.preventDefault(); onToggle(); }} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-accent">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} Use {theme === "dark" ? "light" : "dark"} mode</DropdownMenu.Item><DropdownMenu.Item asChild><Link className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-destructive outline-none hover:bg-accent" href="/auth/signout"><LogOut size={16} /> Sign out</Link></DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}

export function AppShell({ children, profile }: { children: React.ReactNode; profile: ShellProfile }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState<SearchIndexItem[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => { const stored = window.localStorage.getItem("recallcode-theme"); const value = stored === "dark" || stored === "light" ? stored : "light"; document.documentElement.dataset.theme = value; const timer = window.setTimeout(() => setTheme(value), 0); return () => window.clearTimeout(timer); }, []);
  const toggleTheme = useCallback(() => setTheme((value) => { const next = value === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; window.localStorage.setItem("recallcode-theme", next); return next; }), []);
  const openSearch = useCallback(() => { setSearchOpen(true); if (!searchIndex) startTransition(async () => setSearchIndex(await getSearchIndex())); }, [searchIndex]);
  useEffect(() => { const clear = () => { setSearchIndex(null); setQuery(""); }; const keydown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); } }; window.addEventListener("recallcode:catalog-changed", clear); window.addEventListener("keydown", keydown); return () => { window.removeEventListener("recallcode:catalog-changed", clear); window.removeEventListener("keydown", keydown); }; }, [openSearch]);
  const results = useMemo(() => { const normalized = query.trim().toLowerCase(); if (!normalized || !searchIndex) return []; return searchIndex.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized)).slice(0, 12); }, [query, searchIndex]);

  return <TooltipProvider delayDuration={250}><div className="min-h-dvh bg-background text-foreground">
    <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-card px-3 py-4 md:flex md:flex-col", sidebarCollapsed ? "w-[68px]" : "w-56")}>
      <div className="flex h-10 items-center justify-between gap-2 px-1"><Link href="/dashboard" className="flex min-w-0 items-center gap-2 font-semibold tracking-tight"><span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><Code2 size={16} /></span>{!sidebarCollapsed && <span>RecallCode</span>}</Link>{!sidebarCollapsed && <ThemeButton theme={theme} onToggle={toggleTheme} />}</div>
      <nav className="mt-7 grid gap-1" aria-label="Main navigation">{navigation.map(({ href, label, icon: Icon }) => <Tooltip key={href}><TooltipTrigger asChild><Link className={cn("flex min-h-10 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", pathname === href && "bg-accent text-accent-foreground", sidebarCollapsed && "justify-center px-0")} href={href}><Icon size={17} /><span className={cn(sidebarCollapsed && "sr-only")}>{label}</span></Link></TooltipTrigger>{sidebarCollapsed && <TooltipContent side="right">{label}</TooltipContent>}</Tooltip>)}</nav>
      <div className="mt-auto border-t border-border pt-3"><div className={cn("mb-2 flex", sidebarCollapsed ? "justify-center" : "justify-end")}><Button variant="ghost" size="icon-sm" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? ">" : "<"}</Button></div><UserMenu compact={sidebarCollapsed} profile={profile} theme={theme} onToggle={toggleTheme} /></div>
    </aside>
    <div className={cn("min-h-dvh transition-[padding] md:pl-56", sidebarCollapsed && "md:pl-[68px]")}><header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-6"><Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight md:hidden"><span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><Code2 size={16} /></span>RecallCode</Link><div className="hidden md:block" /><button type="button" onClick={openSearch} className="flex min-h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent sm:w-72"><Search size={16} /><span className="flex-1">Search problems…</span><kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:block">⌘ K</kbd></button><div className="flex gap-1 md:hidden"><ThemeButton theme={theme} onToggle={toggleTheme} /><Button variant="ghost" size="icon-sm" asChild><Link href="/settings" aria-label="Open settings"><Settings size={16} /></Link></Button></div></header><main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-10">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur md:hidden" aria-label="Main navigation">{navigation.map(({ href, label, icon: Icon }) => <Link className={cn("grid min-h-12 place-items-center gap-0.5 rounded-md text-[10px] font-medium text-muted-foreground", pathname === href && "bg-accent text-accent-foreground")} href={href} key={href}><Icon size={18} /><span>{label}</span></Link>)}</nav>
    <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" /><Dialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none"><Dialog.Title className="sr-only">Search RecallCode</Dialog.Title><div className="flex h-14 items-center gap-3 border-b border-border px-4"><Search size={18} className="text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search problems or patterns…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Close search"><X size={17} /></Button></Dialog.Close></div><div className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">{pending && <p className="px-3 py-6 text-sm text-muted-foreground">Loading your catalog…</p>}{!pending && !query && <p className="px-3 py-6 text-sm text-muted-foreground">Search the selected catalog by title or pattern.</p>}{!pending && query && results.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">No matching problems or patterns.</p>}{results.map((result) => <Link href={result.href} key={`${result.type}-${result.href}`} onClick={() => { setSearchOpen(false); setQuery(""); }} className="flex min-h-12 items-center gap-3 rounded-md px-3 py-2 hover:bg-accent"><span className="grid size-7 place-items-center rounded bg-muted text-muted-foreground">{result.type === "problem" ? <Code2 size={14} /> : <Command size={14} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{result.title}</span><span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span></span><Check size={15} className="text-muted-foreground" /></Link>)}</div></Dialog.Content></Dialog.Portal></Dialog.Root>
  <Toaster theme={theme} position="bottom-right" richColors closeButton /></div></TooltipProvider>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) { return <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center"><Code2 className="mx-auto mb-3 text-muted-foreground" size={26} /><h2 className="text-base font-semibold">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>{action && <div className="mt-4">{action}</div>}</div>; }
