"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command as CommandPalette } from "cmdk";
import { Command as CommandIcon, Code2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CATALOGS } from "@/lib/constants";
import type { CatalogId } from "@/lib/types";

export type SearchIndexItem = { type: "problem" | "pattern"; title: string; subtitle: string; href: string };

export function SearchCommand({ open, onOpenChange, index, loading, catalogName, catalogId, onCatalogChange, catalogPending }: { open: boolean; onOpenChange: (open: boolean) => void; index: SearchIndexItem[] | null; loading: boolean; catalogName: string; catalogId: CatalogId; onCatalogChange: (value: CatalogId) => void; catalogPending: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || !index) return [];
    return index.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized)).slice(0, 12);
  }, [index, query]);
  const close = () => { setQuery(""); onOpenChange(false); };
  const setOpen = (nextOpen: boolean) => { if (!nextOpen) setQuery(""); onOpenChange(nextOpen); };
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" /><Dialog.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none"><Dialog.Title className="sr-only">Search RecallCode</Dialog.Title><CommandPalette className="overflow-hidden" shouldFilter={false}><div className="flex h-14 items-center gap-3 border-b border-border px-4"><Search size={17} className="text-muted-foreground" /><CommandPalette.Input autoFocus value={query} onValueChange={setQuery} placeholder="Search by number, title, or pattern…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Close search"><X size={16} /></Button></Dialog.Close></div><div className="flex min-h-11 items-center gap-2 border-b border-border px-4 text-xs"><label htmlFor="search-catalog" className="text-muted-foreground">Browsing catalog</label><select id="search-catalog" value={catalogId} disabled={catalogPending} onChange={(event) => onCatalogChange(event.target.value as CatalogId)} className="min-h-9 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">{(Object.entries(CATALOGS) as [CatalogId, typeof CATALOGS[CatalogId]][]).map(([id, catalog]) => <option key={id} value={id}>{catalog.name}</option>)}</select></div><CommandPalette.List className="max-h-[min(64vh,30rem)] overflow-y-auto p-2">{loading && !index && <CommandPalette.Loading className="px-3 py-8 text-center text-sm text-muted-foreground">Loading {catalogName}…</CommandPalette.Loading>}{!loading && !query && <CommandPalette.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">Find a problem or jump to a pattern.</CommandPalette.Empty>}{!loading && query && results.length === 0 && <CommandPalette.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">No matching problems or patterns.</CommandPalette.Empty>}{results.map((result) => <CommandPalette.Item value={result.title} key={`${result.type}-${result.href}`} onSelect={() => { close(); router.push(result.href); }} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 py-2 data-[selected=true]:bg-accent"><span className="grid size-7 place-items-center rounded bg-muted text-muted-foreground">{result.type === "problem" ? <Code2 size={14} /> : <CommandIcon size={14} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{result.title}</span><span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span></span></CommandPalette.Item>)}</CommandPalette.List></CommandPalette></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
