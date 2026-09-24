"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PendingLinkProps = ComponentProps<typeof Link> & { children: ReactNode };

function PendingHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={cn("pointer-events-none absolute right-1.5 top-1.5 size-1 rounded-full bg-primary opacity-0 transition-opacity delay-100", pending && "animate-pulse opacity-100")} />;
}

/** Gives slow RSC transitions immediate, non-shifting feedback. */
export function PendingLink({ children, className, ...props }: PendingLinkProps) {
  return <Link {...props} className={cn("relative", className)}>{children}<PendingHint /></Link>;
}
