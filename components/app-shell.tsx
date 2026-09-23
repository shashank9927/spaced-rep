"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenCheck, CircleUserRound, History, LayoutDashboard, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/catalog", label: "Catalog", icon: BookOpenCheck },
  { href: "/review", label: "Review", icon: BarChart3 },
  { href: "/history", label: "History", icon: History },
];

export function AppShell({ children, profile }: { children: React.ReactNode; profile: { display_name: string; email: string; role: string } }) {
  const pathname = usePathname();
  return (
    <div className="app-frame">
      <header className="topbar">
        <Link href="/dashboard" className="brand" aria-label="Recall Code home">
          <span className="brand-mark">R</span>
          <span>recall<span className="brand-code">.code</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link className={cn("nav-link", pathname === href && "is-active")} href={href} key={href}>
              <Icon size={17} /> {label}
            </Link>
          ))}
          {profile.role === "admin" && (
            <Link className={cn("nav-link", pathname === "/admin" && "is-active")} href="/admin">
              <ShieldCheck size={17} /> Admin
            </Link>
          )}
        </nav>
        <div className="account-menu">
          <span className="avatar">{profile.display_name.slice(0, 1).toUpperCase()}</span>
          <div className="account-copy">
            <strong>{profile.display_name}</strong>
            <a href="/auth/signout">Sign out</a>
          </div>
        </div>
      </header>
      <main className="main-content">{children}</main>
      <nav className="mobile-nav" aria-label="Main navigation">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link className={cn("mobile-nav-link", pathname === href && "is-active")} href={href} key={href}>
            <Icon size={19} /><span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state"><CircleUserRound size={28} /><h2>{title}</h2><p>{body}</p>{action}</div>;
}
