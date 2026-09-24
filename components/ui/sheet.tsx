"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({ children, className, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Content>) {
  return <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" /><Dialog.Content className={cn("fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background shadow-2xl outline-none motion-safe:animate-in motion-safe:slide-in-from-right", className)} {...props}>{children}</Dialog.Content></Dialog.Portal>;
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)} {...props} />; }
export function SheetTitle(props: React.ComponentPropsWithoutRef<typeof Dialog.Title>) { return <Dialog.Title className="text-base font-semibold text-foreground" {...props} />; }
export function SheetDescription(props: React.ComponentPropsWithoutRef<typeof Dialog.Description>) { return <Dialog.Description className="mt-1 text-sm text-muted-foreground" {...props} />; }
export function SheetDismiss() { return <Dialog.Close aria-label="Close panel" className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={18} /></Dialog.Close>; }
