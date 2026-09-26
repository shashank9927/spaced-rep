import { createEmptyCard, FSRSVersion, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import { RATING_COPY } from "@/lib/constants";
import type { FsrsCardState, RatingOption, ReviewRating } from "@/lib/types";

export const SCHEDULER_PRESENTATION = {
  desiredRetention: 0.9,
  maximumIntervalDays: 365,
} as const;

const scheduler = fsrs({
  request_retention: SCHEDULER_PRESENTATION.desiredRetention,
  maximum_interval: SCHEDULER_PRESENTATION.maximumIntervalDays,
  enable_fuzz: false,
  // Coding reviews are day-sized work, not a minutes-long flashcard session.
  enable_short_term: false,
});

const ratingMap: Record<ReviewRating, Grade> = {
  again: Rating.Again as Grade,
  hard: Rating.Hard as Grade,
  good: Rating.Good as Grade,
  easy: Rating.Easy as Grade,
};

export function fsrsVersion(): string {
  return `ts-fsrs@${FSRSVersion}`;
}

export function toFsrsCard(card: FsrsCardState): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  } as Card;
}

export function newFsrsCard(now: Date): Card {
  return createEmptyCard(now);
}

export function scheduleCard(card: FsrsCardState | null, rating: ReviewRating, now: Date) {
  const previous = card ? toFsrsCard(card) : newFsrsCard(now);
  const result = scheduler.next(previous, now, ratingMap[rating]);
  return { previous, next: result.card, log: result.log };
}

export function ratingOptions(card: FsrsCardState | null, now = new Date()): RatingOption[] {
  const source = card ? toFsrsCard(card) : newFsrsCard(now);
  const choices = scheduler.repeat(source, now);
  return (Object.keys(ratingMap) as ReviewRating[]).map((rating) => {
    const due = choices[ratingMap[rating]].card.due;
    return {
      rating,
      label: RATING_COPY[rating].label,
      detail: RATING_COPY[rating].detail,
      intervalLabel: intervalLabel(now, due),
    };
  });
}

export function intervalLabel(from: Date, due: Date): string {
  const minutes = Math.max(0, Math.round((due.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h`;
  const days = Math.round(minutes / 1_440);
  return `${days}d`;
}

export function cardStateForDatabase(card: Card) {
  return {
    due_at: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review_at: card.last_review?.toISOString() ?? null,
  };
}

export function retrievability(card: FsrsCardState, now = new Date()): number {
  return scheduler.get_retrievability(toFsrsCard(card), now, false);
}
