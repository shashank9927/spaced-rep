import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-transparent bg-secondary text-secondary-foreground",
      easy: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      medium: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      hard: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      due: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      muted: "border-border bg-muted text-muted-foreground",
    },
    },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <div className={cn(badgeVariants({ variant }), className)} {...props} />; }
