"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search, Settings, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getSearchIndex, setActiveCatalog } from "@/lib/actions";
import { CATALOGS } from "@/lib/constants";
import type { CatalogId } from "@/lib/types";
import type { SearchIndexItem } from "@/components/search-command";

const SearchCommand = dynamic(() => import("@/components/search-command").then((module) => module.SearchCommand), { ssr: false });
export type ShellProfile = { display_name: string; email: string; role: string; selected_catalog: CatalogId };

function UserMenu({ profile }: { profile: ShellProfile }) {
  const initials = profile.display_name.slice(0, 2).toUpperCase();
  return <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-secondary text-xs font-semibold text-secondary-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open account menu">{initials}</button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={9} className="z-50 min-w-60 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl"><div className="px-3 py-2"><p className="truncate text-sm font-medium">{profile.display_name}</p><p className="truncate text-xs text-muted-foreground">{profile.email}</p></div><DropdownMenu.Separator className="my-1 h-px bg-border" /><DropdownMenu.Item asChild><Link className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-accent" href="/settings"><Settings size={16} /> Settings</Link></DropdownMenu.Item>{profile.role === "admin" && <DropdownMenu.Item asChild><Link className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-accent" href="/admin"><ShieldCheck size={16} /> Admin</Link></DropdownMenu.Item>}<DropdownMenu.Separator className="my-1 h-px bg-border" /><DropdownMenu.Item asChild><form action="/auth/signout" method="post"><button type="submit" className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-destructive outline-none hover:bg-accent"><LogOut size={16} /> Sign out</button></form></DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}

export function AppShellControls({ profile }: { profile: ShellProfile }) {
  const pathname = usePathname(); const router = useRouter();
  const [catalog, setCatalog] = useState(profile.selected_catalog); const [searchOpen, setSearchOpen] = useState(false); const [searchMounted, setSearchMounted] = useState(false); const [searchIndex, setSearchIndex] = useState<SearchIndexItem[] | null>(null); const [pending, startTransition] = useTransition();
  useEffect(() => { const syncCatalog = (event: Event) => { const value = (event as CustomEvent<string>).detail; if (typeof value === "string" && value in CATALOGS) setCatalog(value as CatalogId); setSearchIndex(null); }; window.addEventListener("recallcode:catalog-changed", syncCatalog); return () => window.removeEventListener("recallcode:catalog-changed", syncCatalog); }, []);
  const openSearch = useCallback(() => { setSearchMounted(true); setSearchOpen(true); if (!searchIndex) startTransition(async () => setSearchIndex(await getSearchIndex())); }, [searchIndex]);
  const switchCatalog = useCallback((value: CatalogId) => { if (value === catalog || pending) return; const previous = catalog; setCatalog(value); setSearchIndex(null); startTransition(async () => { const result = await setActiveCatalog(value); if (!result.ok) { setCatalog(previous); toast.error(result.error); return; } window.dispatchEvent(new CustomEvent("recallcode:catalog-changed", { detail: value })); const index = await getSearchIndex(); setSearchIndex(index); if (pathname === "/problems" || pathname.startsWith("/problems/")) router.refresh(); toast.success(`Browsing ${CATALOGS[value].name}`); }); }, [catalog, pending, pathname, router]);
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); } }; window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown); }, [openSearch]);
  return <><button type="button" onClick={openSearch} className="flex min-h-10 w-10 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-left text-xs text-muted-foreground transition-colors duration-150 hover:border-info/40 hover:bg-accent hover:text-foreground sm:w-48 lg:w-64"><Search size={14} className="shrink-0" /><span className="hidden min-w-0 flex-1 truncate sm:block">Search problem deck…</span><kbd className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] lg:block">⌘K</kbd></button><UserMenu profile={profile} />{searchMounted && <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} index={searchIndex} loading={pending} catalogName={CATALOGS[catalog].name} catalogId={catalog} onCatalogChange={switchCatalog} catalogPending={pending} />}</>;
}
