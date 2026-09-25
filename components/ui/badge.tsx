import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-transparent bg-secondary text-secondary-foreground",
      easy: "border-success/20 bg-success/10 text-success",
      medium: "border-warning/20 bg-warning/10 text-warning",
      hard: "border-destructive/20 bg-destructive/10 text-destructive",
      due: "border-warning/20 bg-warning/10 text-warning",
      muted: "border-border bg-muted text-muted-foreground",
    },
    },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <div className={cn(badgeVariants({ variant }), className)} {...props} />; }
