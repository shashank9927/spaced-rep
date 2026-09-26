import { Skeleton } from "@/components/ui/skeleton";

export default function AuthenticatedLoading() {
  return <section className="grid gap-4" aria-busy="true" aria-live="polite"><span className="sr-only">Loading page</span><Skeleton className="h-12 w-72" /><Skeleton className="h-44" /><Skeleton className="h-44" /></section>;
}
