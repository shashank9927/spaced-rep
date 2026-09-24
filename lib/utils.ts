import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}

export function leetcodeNumberFromSourceId(sourceId: string): number {
  const match = /^(\d+)-/.exec(sourceId);
  if (!match) throw new Error(`Invalid LeetCode source ID: ${sourceId}`);
  const value = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid LeetCode number: ${sourceId}`);
  // The public catalog snapshot keeps NeetCode's stable source IDs. One
  // historical source ID carries LeetCode 2633 while its linked problem is
  // actually LeetCode 2683; preserve the stable ID while displaying truth.
  return sourceId === "2633-neighboring-bitwise-xor" ? 2683 : value;
}

export function localDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

export function formatDateTime(value: string | Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function formatRelativeDue(value: string | Date): string {
  const diff = new Date(value).getTime() - Date.now();
  const hours = Math.round(Math.abs(diff) / 3_600_000);
  if (Math.abs(diff) < 3_600_000) return diff <= 0 ? "due now" : "due in under an hour";
  if (hours < 48) return diff <= 0 ? `${hours}h overdue` : `due in ${hours}h`;
  const days = Math.round(hours / 24);
  return diff <= 0 ? `${days}d overdue` : `due in ${days}d`;
}

export function formatDate(value: string | Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(value));
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function displayNameFromEmail(email: string): string {
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
