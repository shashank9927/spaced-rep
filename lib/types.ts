export const CATALOG_IDS = ["neetcode150", "neetcode250", "allNC"] as const;
export type CatalogId = (typeof CATALOG_IDS)[number];

export const REVIEW_RATINGS = ["again", "hard", "good", "easy"] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];
export type ReviewEventKind = "first_attempt" | "scheduled_review" | "early_review";

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
  leetcodeNumber: number;
  title: string;
  slug: string;
  difficulty: ProblemDifficulty;
  leetcode_url: string | null;
  neetcode_url: string | null;
  topics: string[];
  primaryTopic?: string | null;
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
    first_attempted_at?: string;
    retrievability?: number;
    latest_rating?: ReviewRating | null;
  } | null;
}

/** The compact, browser-safe shape used by the problem deck and search. */
export interface CatalogProblemSummary {
  id: string;
  leetcodeNumber: number;
  title: string;
  difficulty: ProblemDifficulty;
  topics: string[];
  primaryTopic?: string | null;
  sort_order: number;
  card?: CatalogProblem["card"];
}

export interface TodayPayload {
  timezone: string;
  dueReviews: DueProblem[];
  upcomingReviews: DueProblem[];
  firstAttemptsThisWeek: number;
  completedReviewsThisWeek: number;
  activeProblemCount: number;
  medianIntervalDays: number | null;
}

export interface ProblemDeckPayload {
  catalogId: CatalogId;
  problems: CatalogProblemSummary[];
  activeCount: number;
  dueCount: number;
}

export interface ScheduleAgendaPayload {
  todayKey: string;
  days: ScheduleDay[];
}

/** Browser-safe Progress DTO: it deliberately excludes raw cards and logs. */
export interface AttentionProblem {
  id: string;
  leetcodeNumber: number;
  title: string;
  topics: string[];
  primaryTopic?: string | null;
  reason: "due" | "forgot" | "hard" | "repeated-lapses";
  scheduledDays: number;
  dueAt: string;
}

export interface ProgressSummary {
  activeProblemCount: number;
  medianIntervalDays: number | null;
  firstAttemptsThisWeek: number;
  completedReviewsThisWeek: number;
  scheduledRecallRate: number | null;
  scheduledRecallSampleSize: number;
}

export interface ActivityDay {
  key: string;
  attempts: number;
  scheduled: number;
  early: number;
}

export interface PatternSignal {
  name: string;
  activeCount: number;
  dueCount: number;
  reinforcementCount: number;
  medianIntervalDays: number | null;
}

export interface ProgressPayload {
  timezone: string;
  hasCards: boolean;
  stats: ProgressSummary;
  reviewLoad: ReviewLoadPayload;
  activity: ActivityDay[];
  attention: AttentionProblem[];
  patterns: PatternSignal[];
}

export interface DueProblem extends ProblemSummary {
  card: FsrsCardState & {
    due_at: string;
    version: number;
    first_attempted_at: string;
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
  previous_due_at: string | null;
  next_due_at: string;
  scheduled_days: number;
  event_kind?: ReviewEventKind;
  result_version?: number | null;
  reversed_at?: string | null;
  problems?: { title: string; difficulty: ProblemDifficulty; source_id?: string; leetcode_number?: number } | null;
}

export type ScheduleItemKind = "review" | "completed-review" | "completed-attempt" | "completed-early-review";

export interface ScheduleItem {
  dateKey: string;
  kind: ScheduleItemKind;
  status: "overdue" | "due" | "upcoming" | "completed";
  problem: ProblemSummary;
  dueAt?: string;
}

export interface ScheduleDay {
  dateKey: string;
  items: ScheduleItem[];
}

export interface ReviewLoadDay {
  dateKey: string;
  label: string;
  shortLabel?: string;
  fullLabel?: string;
  dueCount: number;
  completedCount: number;
  completedReviewCount?: number;
  remainingTodayCount?: number;
  futureDueCount?: number;
  isToday: boolean;
}

export interface ReviewLoadPayload {
  overdueCount: number;
  totalDueNext14Days: number;
  peakDay: ReviewLoadDay | null;
  days: ReviewLoadDay[];
}

export interface SubmitReviewInput {
  problemId: string;
  rating: ReviewRating;
  note?: string;
  requestId: string;
}

export interface CompleteUserProblemCard extends FsrsCardState {
  problemId: string;
  dueAt: string;
  version: number;
  firstAttemptedAt: string;
  latestRating: ReviewRating;
}
