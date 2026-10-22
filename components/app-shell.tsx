"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenText, CalendarDays, Code2, LayoutDashboard, Moon, Sun } from "lucide-react";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PendingLink } from "@/components/pending-link";
import { ReviewUndoProvider } from "@/components/review-undo-provider";
import { Empty } from "@/components/ui/empty";

const navigation = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: BookOpenText },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];

type Theme = "light" | "dark";

function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" type="button" onClick={onToggle} aria-label={`Switch to ${next} mode`}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</Button></TooltipTrigger><TooltipContent>Switch to {next} mode</TooltipContent></Tooltip>;
}

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return <>{navigation.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const classes = mobile
      ? cn("grid min-h-12 place-items-center content-center gap-0.5 rounded-lg text-[10px] font-medium text-muted-foreground", active && "bg-accent text-accent-foreground")
      : cn("flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground", active && "bg-secondary text-foreground");
    return <PendingLink prefetch className={classes} href={href} key={href}><Icon size={mobile ? 17 : 14} />{mobile ? <span>{label}</span> : label}</PendingLink>;
  })}</>;
}

function NavigationFallback({ mobile = false }: { mobile?: boolean }) {
  return <>{navigation.map(({ href, label, icon: Icon }) => {
    const classes = mobile
      ? "grid min-h-12 place-items-center content-center gap-0.5 rounded-lg text-[10px] font-medium text-muted-foreground"
      : "flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground";
    return <Link prefetch href={href} className={classes} key={href}><Icon size={mobile ? 17 : 14} />{mobile ? <span>{label}</span> : label}</Link>;
  })}</>;
}

/** The frame has no private data dependency; profile controls stream into it. */
export function AppShell({ children, controls, problem }: { children: ReactNode; controls: ReactNode; problem?: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const stored = window.localStorage.getItem("recallcode-theme");
    const value = stored === "dark" || stored === "light" ? stored : "dark";
    document.documentElement.dataset.theme = value;
    const timer = window.setTimeout(() => setTheme(value), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggleTheme = useCallback(() => setTheme((value) => {
    const next = value === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("recallcode-theme", next);
    return next;
  }), []);

  return <TooltipProvider delayDuration={250}><ReviewUndoProvider><div className="min-h-dvh bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl"><div className="mx-auto flex h-15 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8"><Link href="/today" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-[-.035em]"><span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"><Code2 size={17} strokeWidth={2.4} /></span><span className="hidden text-[15px] sm:inline">RecallCode</span></Link><nav className="ml-2 hidden items-center gap-0.5 rounded-lg border border-border bg-card/60 p-1 md:flex" aria-label="Main navigation"><Suspense fallback={<NavigationFallback />}><NavigationLinks /></Suspense></nav><div className="ml-auto flex min-w-0 items-center gap-1.5">{controls}<ThemeButton theme={theme} onToggle={toggleTheme} /></div></div></header>
    <main className="mx-auto w-full max-w-[1280px] px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-12 lg:px-8">{children}</main>
    <nav className="fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-4 rounded-xl border border-border bg-card/94 p-1 shadow-2xl backdrop-blur-xl md:hidden" aria-label="Main navigation"><Suspense fallback={<NavigationFallback mobile />}><NavigationLinks mobile /></Suspense></nav>
    {problem}
    <Toaster theme={theme} position="top-right" offset={{ top: "76px", right: "20px" }} mobileOffset={{ top: "76px", right: "12px", left: "12px" }} richColors closeButton />
  </div></ReviewUndoProvider></TooltipProvider>;
}

export function ShellControlsSkeleton() {
  return <div aria-label="Loading account controls" className="flex items-center gap-1.5"><span className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-muted sm:w-48 md:w-10 lg:w-64" /><span className="size-10 shrink-0 animate-pulse rounded-md bg-muted" /></div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <Empty icon={<Code2 size={26} />} title={title} description={body} action={action} />; }
