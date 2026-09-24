"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenText, CalendarDays, Check, Code2, Command, LayoutDashboard, LogOut, Moon, Search, Settings, ShieldCheck, Sun, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Toaster } from "sonner";
import { getSearchIndex, setActiveCatalog } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import type { CatalogId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: BookOpenText },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];

type ShellProfile = { display_name: string; email: string; role: string; selected_catalog: CatalogId };
type Theme = "light" | "dark";
type SearchIndexItem = { type: "problem" | "pattern"; title: string; subtitle: string; href: string };

function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" type="button" onClick={onToggle} aria-label={`Switch to ${next} mode`}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</Button></TooltipTrigger><TooltipContent>Switch to {next} mode</TooltipContent></Tooltip>;
}

function UserMenu({ profile, theme, onToggle }: { profile: ShellProfile; theme: Theme; onToggle: () => void }) {
  const initials = profile.display_name.slice(0, 2).toUpperCase();
  return <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary text-xs font-semibold text-secondary-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open account menu">{initials}</button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={9} className="z-50 min-w-60 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl"><div className="px-3 py-2"><p className="truncate text-sm font-medium">{profile.display_name}</p><p className="truncate text-xs text-muted-foreground">{profile.email}</p></div><DropdownMenu.Separator className="my-1 h-px bg-border" /><DropdownMenu.Item asChild><Link className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-accent" href="/settings"><Settings size={16} /> Settings</Link></DropdownMenu.Item>{profile.role === "admin" && <DropdownMenu.Item asChild><Link className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-accent" href="/admin"><ShieldCheck size={16} /> Admin</Link></DropdownMenu.Item>}<DropdownMenu.Item onSelect={(event) => { event.preventDefault(); onToggle(); }} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-accent">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} Use {theme === "dark" ? "light" : "dark"} mode</DropdownMenu.Item><DropdownMenu.Separator className="my-1 h-px bg-border" /><DropdownMenu.Item asChild><Link className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-destructive outline-none hover:bg-accent" href="/auth/signout"><LogOut size={16} /> Sign out</Link></DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}

function CatalogMenu({ value, onChange, pending }: { value: CatalogId; onChange: (value: CatalogId) => void; pending: boolean }) {
  return <DropdownMenu.Root><DropdownMenu.Trigger asChild><button type="button" disabled={pending} className="hidden min-h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:flex"><span className="size-1.5 rounded-full bg-cyan-500" />{CATALOGS[value].name.replace("NeetCode ", "NC ")}</button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={9} className="z-50 min-w-44 rounded-lg border border-border bg-popover p-1 shadow-xl">{(Object.keys(CATALOGS) as CatalogId[]).map((id) => <DropdownMenu.Item key={id} onSelect={() => onChange(id)} className="flex min-h-9 cursor-pointer items-center justify-between rounded-md px-3 text-sm outline-none hover:bg-accent"><span>{CATALOGS[id].name}</span>{id === value && <Check size={14} className="text-primary" />}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}

export function AppShell({ children, profile }: { children: React.ReactNode; profile: ShellProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("light");
  const [catalog, setCatalog] = useState(profile.selected_catalog);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState<SearchIndexItem[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => { const stored = window.localStorage.getItem("recallcode-theme"); const value = stored === "dark" || stored === "light" ? stored : "light"; document.documentElement.dataset.theme = value; const timer = window.setTimeout(() => setTheme(value), 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const syncCatalog = (event: Event) => { const value = (event as CustomEvent<string>).detail; if (typeof value === "string" && value in CATALOGS) setCatalog(value as CatalogId); setSearchIndex(null); setQuery(""); }; window.addEventListener("recallcode:catalog-changed", syncCatalog); return () => window.removeEventListener("recallcode:catalog-changed", syncCatalog); }, []);
  const toggleTheme = useCallback(() => setTheme((value) => { const next = value === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; window.localStorage.setItem("recallcode-theme", next); return next; }), []);
  const openSearch = useCallback(() => { setSearchOpen(true); if (!searchIndex) startTransition(async () => setSearchIndex(await getSearchIndex())); }, [searchIndex]);
  const switchCatalog = useCallback((value: CatalogId) => { if (value === catalog) return; const previous = catalog; setCatalog(value); startTransition(async () => { const result = await setActiveCatalog(value); if (!result.ok) { setCatalog(previous); return; } setSearchIndex(null); setQuery(""); window.dispatchEvent(new CustomEvent("recallcode:catalog-changed", { detail: value })); router.refresh(); }); }, [catalog, router]);
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); } }; window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown); }, [openSearch]);
  const results = useMemo(() => { const normalized = query.trim().toLowerCase(); if (!normalized || !searchIndex) return []; return searchIndex.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized)).slice(0, 12); }, [query, searchIndex]);

  return <TooltipProvider delayDuration={250}><div className="min-h-dvh bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b border-border bg-background/88 backdrop-blur-xl"><div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-3 sm:px-5 lg:px-6"><Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"><span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm"><Code2 size={16} /></span><span className="hidden sm:inline">RecallCode</span></Link><nav className="ml-2 hidden items-center gap-1 rounded-lg bg-muted p-1 md:flex" aria-label="Main navigation">{navigation.map(({ href, label, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link className={cn("flex min-h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground", active && "bg-card text-foreground shadow-sm")} href={href} key={href}><Icon size={14} />{label}</Link>; })}</nav><div className="ml-auto flex min-w-0 items-center gap-1.5"><CatalogMenu value={catalog} onChange={switchCatalog} pending={pending} /><button type="button" onClick={openSearch} className="flex min-h-8 w-9 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:w-44 lg:w-56"><Search size={14} className="shrink-0" /><span className="hidden min-w-0 flex-1 truncate sm:block">Search problems…</span><kbd className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] lg:block">⌘K</kbd></button><ThemeButton theme={theme} onToggle={toggleTheme} /><UserMenu profile={profile} theme={theme} onToggle={toggleTheme} /></div></div></header>
    <main className="mx-auto w-full max-w-7xl px-4 py-7 pb-24 sm:px-6 md:py-8 md:pb-12">{children}</main>
    <nav className="fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-4 rounded-xl border border-border bg-card/94 p-1 shadow-2xl backdrop-blur-xl md:hidden" aria-label="Main navigation">{navigation.map(({ href, label, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link className={cn("grid min-h-12 place-items-center content-center gap-0.5 rounded-lg text-[10px] font-medium text-muted-foreground", active && "bg-accent text-accent-foreground")} href={href} key={href}><Icon size={17} /><span>{label}</span></Link>; })}</nav>
    <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" /><Dialog.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none"><Dialog.Title className="sr-only">Search RecallCode</Dialog.Title><div className="flex h-14 items-center gap-3 border-b border-border px-4"><Search size={17} className="text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by number, title, or pattern…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Close search"><X size={16} /></Button></Dialog.Close></div><div className="max-h-[min(64vh,30rem)] overflow-y-auto p-2">{pending && !searchIndex && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading {CATALOGS[catalog].name}…</p>}{!pending && !query && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Find a problem or jump to a pattern.</p>}{!pending && query && results.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matching problems or patterns.</p>}{results.map((result) => <Link href={result.href} key={`${result.type}-${result.href}`} onClick={() => { setSearchOpen(false); setQuery(""); }} className="flex min-h-12 items-center gap-3 rounded-md px-3 py-2 hover:bg-accent"><span className="grid size-7 place-items-center rounded bg-muted text-muted-foreground">{result.type === "problem" ? <Code2 size={14} /> : <Command size={14} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{result.title}</span><span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span></span></Link>)}</div></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Toaster theme={theme} position="bottom-right" richColors closeButton />
  </div></TooltipProvider>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) { return <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center"><Code2 className="mx-auto mb-3 text-muted-foreground" size={26} /><h2 className="text-base font-semibold">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>{action && <div className="mt-4">{action}</div>}</div>; }
