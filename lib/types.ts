export const CATALOG_IDS = ["neetcode150", "neetcode250", "allNC"] as const;
export type CatalogId = (typeof CATALOG_IDS)[number];

export const REVIEW_RATINGS = ["again", "hard", "good", "easy"] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export type ProblemDifficulty = "Easy" | "Medium" | "Hard";
export type ProblemStatus = "new" | "active" | "due";

export interface FsrsCardState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string | null;
}

export interface ProblemSummary {
  id: string;
  source_id: string;
  title: string;
  slug: string;
  difficulty: ProblemDifficulty;
  leetcode_url: string | null;
  neetcode_url: string | null;
  topics: string[];
}

export interface CatalogProblem extends ProblemSummary {
  sort_order: number;
  card?: {
    due_at: string;
    reps: number;
    last_review_at: string | null;
  } | null;
}

export interface DueProblem extends ProblemSummary {
  card: FsrsCardState & {
    due_at: string;
    version: number;
    first_solved_at: string;
  };
}

export interface RatingOption {
  rating: ReviewRating;
  label: string;
  detail: string;
  intervalLabel: string;
}
