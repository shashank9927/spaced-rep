import { z } from "zod";

/** Browser-safe validation helpers shared by server actions and rendering code. */
export const timezoneSchema = z.string().trim().min(1).max(80).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "Enter a valid IANA timezone.");

export const safeNoteSchema = z.string().trim().max(2000).optional().default("");

export function safeErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("stale card") || message.includes("version conflict")) {
      return "This problem changed in another tab. Refresh and rate it again.";
    }
    if (message.includes("rate limit") || message.includes("too many")) {
      return "Too many requests. Please wait a moment and try again.";
    }
    if (message.includes("not authorized") || message.includes("forbidden")) {
      return "You no longer have access to this action.";
    }
    if (message.includes("duplicate") || message.includes("conflict")) {
      return "This request conflicts with a newer change. Refresh and try again.";
    }
  }
  return fallback;
}

export function configuredSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) return null;
    return url;
  } catch {
    return null;
  }
}

export function isAllowedExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return url.hostname === "leetcode.com" || url.hostname.endsWith(".leetcode.com") || url.hostname === "neetcode.io" || url.hostname.endsWith(".neetcode.io");
  } catch {
    return false;
  }
}

export function requestCorrelationId() {
  return crypto.randomUUID();
}
