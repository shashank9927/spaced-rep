"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Legend, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color: string }>;
const ChartContext = createContext<ChartConfig>({});

export function ChartContainer({ config, children, className = "" }: { config: ChartConfig; children: ReactNode; className?: string }) {
  const variables = Object.fromEntries(Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color])) as CSSProperties;
  return <ChartContext.Provider value={config}><div className={cn("min-h-[11rem] w-full", className)} style={variables}>
    <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
  </div></ChartContext.Provider>;
}

export const ChartTooltip = Tooltip;
export const ChartLegend = Legend;

type TooltipEntry = { name?: string; value?: string | number; color?: string; dataKey?: string | number };
export function ChartTooltipContent({ active, payload, label, className }: { active?: boolean; payload?: readonly TooltipEntry[]; label?: string | number; className?: string }) {
  const config = useContext(ChartContext);
  if (!active || !payload?.length) return null;
  return <div className={cn("min-w-36 rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg", className)}>{label !== undefined && <p className="mb-1 text-xs font-semibold">{label}</p>}<div className="space-y-1">{payload.map((entry) => { const key = String(entry.dataKey ?? entry.name ?? "value"); const item = config[key]; return <div className="flex items-center justify-between gap-4 text-xs" key={key}><span className="flex items-center gap-2 text-muted-foreground"><i className="size-2 rounded-[2px]" style={{ background: entry.color ?? item?.color }} />{item?.label ?? entry.name ?? key}</span><span className="font-mono font-medium">{entry.value ?? 0}</span></div>; })}</div></div>;
}

type LegendEntry = { dataKey?: string | number; value?: string | number; color?: string };
export function ChartLegendContent({ payload, className }: { payload?: readonly LegendEntry[]; className?: string }) {
  const config = useContext(ChartContext);
  if (!payload?.length) return null;
  return <div className={cn("flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground", className)}>{payload.map((entry) => { const key = String(entry.dataKey ?? entry.value ?? "value"); return <span className="flex items-center gap-1.5" key={key}><i className="size-2 rounded-[2px]" style={{ background: entry.color ?? config[key]?.color }} />{config[key]?.label ?? entry.value ?? key}</span>; })}</div>;
}
