import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoading({ variant = "list" }: { variant?: "list" | "detail" | "chart" }) {
  const body = variant === "chart"
    ? <><Skeleton className="h-44" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-36" /><Skeleton className="h-36" /></div></>
    : variant === "detail"
      ? <><Skeleton className="h-9 w-3/4" /><Skeleton className="h-20" /><Skeleton className="h-56" /></>
      : <><Skeleton className="h-9 w-56" /><Skeleton className="h-24" /><Skeleton className="h-52" /></>;
  return <section className="grid gap-4" aria-busy="true" aria-live="polite"><span className="sr-only">Loading page</span>{body}</section>;
}
