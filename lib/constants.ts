import type { CatalogId, ReviewRating } from "@/lib/types";

export const CATALOGS: Record<CatalogId, { name: string; description: string }> = {
  neetcode150: {
    name: "NeetCode 150",
    description: "The core interview-practice list.",
  },
  neetcode250: {
    name: "NeetCode 250",
    description: "A longer, beginner-friendly progression.",
  },
  allNC: {
    name: "NeetCode All",
    description: "Every problem included in the imported catalog snapshot.",
  },
};

export const RATING_COPY: Record<ReviewRating, { label: string; detail: string; key: string }> = {
  again: { label: "Forgot", detail: "Could not reproduce the approach.", key: "1" },
  hard: { label: "Hard", detail: "Needed major hints or too much time.", key: "2" },
  good: { label: "Good", detail: "Solved independently with reasonable effort.", key: "3" },
  easy: { label: "Easy", detail: "The approach was immediately clear.", key: "4" },
};

export const SCHEDULER_VERSION = "ts-fsrs@5.4.2 / retention=0.9 / max=365d";
