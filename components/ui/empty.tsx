import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Empty({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description: string; action?: ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center", className)}>{icon && <div className="mx-auto mb-3 grid size-8 place-items-center text-muted-foreground">{icon}</div>}<h2 className="text-base font-semibold">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
