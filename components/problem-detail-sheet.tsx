"use client";

import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDismiss, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function ProblemDetailSheet({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  return <Sheet open onOpenChange={(open) => { if (!open) router.back(); }}><SheetContent><SheetHeader><SheetTitle>{title}</SheetTitle><SheetDismiss /></SheetHeader>{children}</SheetContent></Sheet>;
}
