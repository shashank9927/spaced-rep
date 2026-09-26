import { RATING_COPY } from "@/lib/constants";
import type { ReviewRating } from "@/lib/types";
import { cn } from "@/lib/utils";

const order: ReviewRating[] = ["again", "hard", "good", "easy"];

export function RatingDefinitions({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <div className={cn("grid gap-2", compact ? "sm:grid-cols-2" : "", className)}>{order.map((rating) => <div className="rounded-md border border-border bg-background/60 px-3 py-2" key={rating}><strong className="block text-xs font-medium">{RATING_COPY[rating].label}</strong><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{RATING_COPY[rating].detail}</span></div>)}</div>;
}
