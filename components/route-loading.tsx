export function RouteLoading({ variant = "list" }: { variant?: "list" | "detail" | "chart" }) {
  const body = variant === "chart"
    ? <><div className="skeleton h-44" /><div className="grid grid-cols-2 gap-4"><div className="skeleton h-36" /><div className="skeleton h-36" /></div></>
    : variant === "detail"
      ? <><div className="skeleton h-9 w-3/4" /><div className="skeleton h-20" /><div className="skeleton h-56" /></>
      : <><div className="skeleton h-9 w-56" /><div className="skeleton h-24" /><div className="skeleton h-52" /></>;
  return <section className="page-loading" aria-busy="true" aria-live="polite"><span className="sr-only">Loading page</span>{body}</section>;
}
