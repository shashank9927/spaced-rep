import { AlertTriangle, CalendarClock, Check, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import type { ReviewLoadPayload } from "@/lib/types";

export function ReviewLoadChart({ load }: { load: ReviewLoadPayload }) {
  const maxDue = Math.max(1, ...load.days.map((day) => day.dueCount));

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock size={15} className="text-primary" aria-hidden="true" />
            Review load
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Actual FSRS reviews due over the next 14 local days.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <SummaryChip tone="overdue" icon={<AlertTriangle size={12} aria-hidden="true" />} label={`${load.overdueCount} overdue`} />
          <SummaryChip tone="today" label={`${load.totalDueNext14Days} upcoming`} />
          {load.peakDay ? <SummaryChip tone="peak" icon={<TrendingUp size={12} aria-hidden="true" />} label={`Peak ${load.peakDay.label}`} /> : null}
        </div>
      </div>

      {load.totalDueNext14Days === 0 && load.overdueCount === 0 ? (
        <div className="flex min-h-36 items-center justify-center px-5 py-8 text-center text-sm text-muted-foreground">
          Record your first attempt to build your review schedule.
        </div>
      ) : (
        <div className="overflow-x-auto px-4 py-5 sm:px-5">
          <div className="review-load-bars min-w-[41rem]" role="list" aria-label="Upcoming review load by day">
            {load.days.map((day) => {
              const height = day.dueCount ? Math.max(8, Math.round((day.dueCount / maxDue) * 100)) : 2;
              const status = day.isToday ? "today" : "upcoming";
              const reviewLabel = `${day.label}: ${day.dueCount} ${day.dueCount === 1 ? "review" : "reviews"} due${day.completedCount ? `, ${day.completedCount} completed` : ""}`;
              return (
                <div className="review-load-column" key={day.dateKey} role="listitem">
                  <div className="flex h-5 items-center justify-center font-mono text-[11px] font-semibold text-foreground">
                    {day.dueCount || ""}
                  </div>
                  <div
                    className={`review-load-bar ${status}`}
                    style={{ height: `${height}%` }}
                    title={reviewLabel}
                    tabIndex={0}
                    role="img"
                    aria-label={reviewLabel}
                  />
                  <span className={`mt-2 whitespace-nowrap font-mono text-[10px] ${day.isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                    {day.isToday ? "Today" : day.label}
                  </span>
                  <span className="mt-1 flex min-h-4 items-center gap-1 text-[10px] text-muted-foreground" aria-label={day.completedCount ? `${day.completedCount} completed` : "No completed reviews"}>
                    {day.completedCount ? <><Check size={10} className="text-emerald-500" aria-hidden="true" /> {day.completedCount}</> : " "}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground" aria-label="Chart legend">
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary" aria-hidden="true" />Today</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-cyan-500" aria-hidden="true" />Upcoming</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />Completed</span>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryChip({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: "overdue" | "today" | "peak";
  icon?: ReactNode;
}) {
  const classes = tone === "overdue"
    ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
    : tone === "today"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
  return <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] font-semibold ${classes}`}>{icon}{label}</span>;
}
