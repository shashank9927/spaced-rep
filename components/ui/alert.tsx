import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ variant = "default", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "success" | "warning" }) {
  return <div role={variant === "destructive" ? "alert" : "status"} className={cn("relative rounded-lg border px-4 py-3 text-sm", variant === "default" && "border-border bg-card", variant === "destructive" && "border-destructive/30 bg-destructive/10 text-destructive", variant === "success" && "border-success/30 bg-success/10 text-success", variant === "warning" && "border-warning/30 bg-warning/10", className)} {...props} />;
}
export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />; }
export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />; }
