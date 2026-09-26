"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "@/lib/utils";

export function Calendar({
  month,
  selected,
  onSelect,
  modifiers,
}: {
  month: Date;
  selected?: Date;
  onSelect: (date: Date) => void;
  modifiers?: Record<string, Date[]>;
}) {
  return <div className="rc-calendar overflow-x-auto p-3"><DayPicker
    month={month}
    showOutsideDays
    fixedWeeks
    weekStartsOn={1}
    selected={selected}
    onDayClick={onSelect}
    modifiers={modifiers}
    modifiersClassNames={{
      review: "rc-calendar-review",
      completed: "rc-calendar-completed",
    }}
    labels={{
      labelDayButton: (date) => {
        const key = date.toISOString().slice(0, 10);
        const dateLabel = new Intl.DateTimeFormat("en", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(date);
        const indicators = [
          modifiers?.review?.some((value) => value.toISOString().slice(0, 10) === key) ? "reviews scheduled" : "",
          modifiers?.completed?.some((value) => value.toISOString().slice(0, 10) === key) ? "activity completed" : "",
        ].filter(Boolean);
        return indicators.length ? `${dateLabel}, ${indicators.join(", ")}` : dateLabel;
      },
    }}
    classNames={{
      root: "w-full min-w-[34rem] text-sm",
      months: "w-full",
      month: "w-full space-y-2",
      month_caption: "hidden",
      nav: "hidden",
      month_grid: "w-full border-collapse",
      weekdays: "border-b border-border",
      weekday: "h-8 text-center font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground",
      week: "border-b border-border last:border-b-0",
      day: "h-16 border-r border-border p-1 text-center last:border-r-0 sm:h-20",
      day_button: "grid size-8 place-items-center rounded-md text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary",
      today: "[&>button]:border [&>button]:border-primary/60",
      outside: "opacity-35",
    }}
  /></div>;
}
