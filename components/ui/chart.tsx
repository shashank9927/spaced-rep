"use client";

import { ResponsiveContainer } from "recharts";
import type { CSSProperties, ReactNode } from "react";

export type ChartConfig = Record<string, { label: string; color: string }>;

export function ChartContainer({ config, children, className = "" }: { config: ChartConfig; children: ReactNode; className?: string }) {
  const variables = Object.fromEntries(Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color])) as CSSProperties;
  return <div className={`min-h-[11rem] w-full ${className}`} style={variables}>
    <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
  </div>;
}
