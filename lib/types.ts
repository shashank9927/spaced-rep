export const CATALOG_IDS = ["neetcode150", "neetcode250", "allNC"] as const;
export type CatalogId = (typeof CATALOG_IDS)[number];

export const REVIEW_RATINGS = ["again", "hard", "good", "easy"] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export const PATTERN_RECALLS = ["no", "partial", "yes"] as const;
export type PatternRecall = (typeof PATTERN_RECALLS)[number];

export type ProblemDifficulty = "Easy" | "Medium" | "Hard";
export type ProblemStatus = "new" | "active" | "due";

export const STUDY_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type StudyWeekday = (typeof STUDY_WEEKDAYS)[number];

export interface StudyPlanPreferences {
  easyPerDay: number;
  mediumPerDay: number;
  hardPerDay: number;
  studyDays: StudyWeekday[];
  configured: boolean;
}

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
  leetcodeNumber: number;
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
    stability?: number;
    lapses?: number;
    scheduled_days?: number;
    first_solved_at?: string;
    retrievability?: number;
    latest_rating?: ReviewRating | null;
  } | null;
}

export interface DueProblem extends ProblemSummary {
  card: FsrsCardState & {
    due_at: string;
    version: number;
    first_solved_at: string;
  };
  retrievability?: number;
  latest_rating?: ReviewRating | null;
  latest_note?: string | null;
  latest_reviewed_at?: string | null;
}

export interface RatingOption {
  rating: ReviewRating;
  label: string;
  detail: string;
  intervalLabel: string;
}

export interface ReviewLogSummary {
  id: string;
  problem_id: string;
  rating: ReviewRating;
  reviewed_at: string;
  note: string | null;
  duration_minutes: number | null;
  pattern_recall: PatternRecall | null;
  previous_due_at: string | null;
  next_due_at: string;
  scheduled_days: number;
  problems?: { title: string; difficulty: ProblemDifficulty; source_id?: string } | null;
}

export interface ScheduleItem {
  dateKey: string;
  kind: "review" | "new" | "completed-review" | "completed-new";
  status: "overdue" | "due" | "upcoming" | "completed";
  problem: ProblemSummary;
  dueAt?: string;
}

export interface ScheduleDay {
  dateKey: string;
  isStudyDay: boolean;
  items: ScheduleItem[];
}

export interface SubmitReviewInput {
  problemId: string;
  rating: ReviewRating;
  note?: string;
  requestId: string;
}
