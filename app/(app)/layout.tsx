import { Suspense } from "react";
import { AppShell, ShellControlsSkeleton } from "@/components/app-shell";
import { AppShellAccount } from "@/components/app-shell-account";

export default function AuthenticatedLayout({ children, problem }: { children: React.ReactNode; problem?: React.ReactNode }) {
  return <AppShell controls={<Suspense fallback={<ShellControlsSkeleton />}><AppShellAccount /></Suspense>} problem={problem}>{children}</AppShell>;
}
