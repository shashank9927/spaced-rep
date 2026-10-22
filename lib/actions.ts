"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SCHEDULER_VERSION } from "@/lib/constants";
import { getProfile, type Profile } from "@/lib/auth";
import { cardStateForDatabase, ratingOptions, retrievability, scheduleCard } from "@/lib/scheduler";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { CATALOG_IDS, REVIEW_RATINGS, type CompleteUserProblemCard, type FsrsCardState, type RatingOption, type ReviewEventKind, type SubmitReviewInput } from "@/lib/types";
import { safeErrorMessage, safeNoteSchema, timezoneSchema } from "@/lib/security";
import { isDueOnOrBeforeLocalDay } from "@/lib/study-plan";
import { getCatalogSearchIndex, getProblemHistoryPage } from "@/lib/queries";
import { measure } from "@/lib/performance";
import { decodeHistoryCursor } from "@/lib/pagination";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
export type SaveSettingsResult = { ok: true; message: string; profile: { display_name: string; timezone: string; selected_catalog: (typeof CATALOG_IDS)[number] } } | { ok: false; error: string };
export type ActionErrorCode = "invalid_input" | "unauthorized" | "conflict" | "rate_limited" | "temporary_failure";
export type ActionFailure = { ok: false; code: ActionErrorCode; error: string; retryable: boolean };
export type ReviewConflictFailure = {
  ok: false;
  code: "conflict";
  error: string;
  retryable: false;
  latestCard: CompleteUserProblemCard;
  retrievabilityNow: number;
  ratingOptions: RatingOption[];
};
export type ReviewActionResult = {
  ok: true; reviewLogId: string; eventKind: ReviewEventKind; nextDue: string; reviewedAt: string; retrievabilityNow: number;
  previousIntervalDays: number; newIntervalDays: number; note: string | null; card: CompleteUserProblemCard; ratingOptions: RatingOption[];
} | ActionFailure | ReviewConflictFailure;
export type UndoReviewResult = { ok: true; message: string; problemId: string; card: CompleteUserProblemCard | null; retrievabilityNow: number | null; ratingOptions: RatingOption[] } | ActionFailure;

function reviewFailure(code: ActionErrorCode, error: string): ActionFailure & { conflict?: boolean } {
  return { ok: false, code, error, retryable: code === "rate_limited" || code === "temporary_failure", ...(code === "conflict" ? { conflict: true } : {}) };
}

async function reviewConflictFailure(userId: string, problemId: string, error: string): Promise<ReviewConflictFailure | ActionFailure> {
  const { data, error: readError } = await createAdminClient().from("user_problem_cards")
    .select("due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at,last_rating,version,first_attempted_at")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .maybeSingle();
  if (readError || !data) return reviewFailure("temporary_failure", "This problem changed in another tab, but its latest state could not be loaded. Open it again and retry.");
  return {
    ok: false,
    code: "conflict",
    error,
    retryable: false,
    latestCard: cardResult(problemId, data),
    retrievabilityNow: retrievability(dbCard(data), new Date()),
    ratingOptions: ratingOptions(dbCard(data)),
  };
}

function classifyActionError(error: unknown): ActionErrorCode {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code);
    if (code === "40001" || code === "23505") return "conflict";
    if (code === "42501" || code === "PGRST301") return "unauthorized";
    if (code === "429") return "rate_limited";
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("sign in") || message.includes("not authorized")) return "unauthorized";
  if (message.includes("rate limit") || message.includes("too many")) return "rate_limited";
  return "temporary_failure";
}

async function activeProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !profile.is_active) throw new Error("You need to sign in again.");
  return profile;
}

const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  timezone: timezoneSchema,
  selectedCatalog: z.enum(CATALOG_IDS),
});

async function saveProfileSettings(profile: Profile, input: z.infer<typeof profileSettingsSchema>, onboardingCompleted: boolean) {
  return createAdminClient().rpc("save_profile_settings_service", {
    p_user_id: profile.id, p_display_name: input.displayName, p_timezone: input.timezone,
    p_selected_catalog: input.selectedCatalog, p_onboarding_completed: onboardingCompleted,
  });
}

export async function saveOnboarding(input: { displayName: string; timezone: string; selectedCatalog: string }): Promise<ActionResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please enter a name and valid catalog." };
  try {
    const profile = await activeProfile();
    const { error } = await saveProfileSettings(profile, parsed.data, true);
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not save onboarding. Please try again.") };
    revalidatePath("/today"); return { ok: true };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not save onboarding. Please try again.") }; }
}

export async function setActiveCatalog(selectedCatalog: string): Promise<ActionResult> {
  const catalog = z.enum(CATALOG_IDS).safeParse(selectedCatalog);
  if (!catalog.success) return { ok: false, error: "Unknown catalog." };
  try {
    const profile = await activeProfile();
    const { error } = await saveProfileSettings(profile, { displayName: profile.display_name ?? "RecallCode user", timezone: profile.timezone, selectedCatalog: catalog.data }, Boolean(profile.display_name));
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not change the catalog.") };
    // Changing the browsing catalog does not change an existing card or its FSRS schedule.
    // Refresh the deck only; the shell updates its selected-catalog state immediately.
    revalidatePath("/problems");
    return { ok: true };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not change the catalog.") }; }
}

const reviewSchema = z.object({ problemId: z.string().uuid(), rating: z.enum(REVIEW_RATINGS), note: safeNoteSchema, requestId: z.string().uuid() });
function dbCard(row: Record<string, any>): FsrsCardState {
  return { due: row.due_at, stability: Number(row.stability), difficulty: Number(row.difficulty), elapsed_days: row.elapsed_days, scheduled_days: row.scheduled_days, learning_steps: row.learning_steps, reps: row.reps, lapses: row.lapses, state: row.state, last_review: row.last_review_at };
}
function cardResult(problemId: string, row: Record<string, any>): CompleteUserProblemCard {
  return { problemId, ...dbCard(row), dueAt: row.due_at, version: row.version, firstAttemptedAt: row.first_attempted_at, latestRating: row.last_rating };
}
function cardSnapshot(row: Record<string, any> | null) {
  if (!row) return null;
  return { first_attempted_at: row.first_attempted_at, due_at: row.due_at, stability: Number(row.stability), difficulty: Number(row.difficulty), elapsed_days: row.elapsed_days, scheduled_days: row.scheduled_days, learning_steps: row.learning_steps, reps: row.reps, lapses: row.lapses, state: row.state, last_review_at: row.last_review_at, last_rating: row.last_rating, version: row.version };
}

type ReviewRpcPayload = {
  review_log_id: string;
  event_kind: ReviewEventKind;
  next_due: string;
  reviewed_at: string;
  previous_interval_days: number;
  new_interval_days: number;
  note: string | null;
  card: Record<string, any> | null;
};

function reviewResultFromRpc(problemId: string, payload: ReviewRpcPayload): ReviewActionResult {
  if (!payload.card) return reviewFailure("temporary_failure", "The review was saved, but its latest card could not be loaded. Open the problem again.");
  const reviewedAt = payload.reviewed_at;
  const state = dbCard(payload.card);
  return {
    ok: true,
    reviewLogId: payload.review_log_id,
    eventKind: payload.event_kind,
    nextDue: payload.next_due,
    reviewedAt,
    retrievabilityNow: retrievability(state, new Date()),
    previousIntervalDays: Number(payload.previous_interval_days ?? 0),
    newIntervalDays: Number(payload.new_interval_days ?? 0),
    note: payload.note ?? null,
    card: cardResult(problemId, payload.card),
    ratingOptions: ratingOptions(dbCard(payload.card)),
  };
}

export async function submitReview(input: SubmitReviewInput): Promise<ReviewActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return reviewFailure("invalid_input", "The review data is invalid. Refresh and try again.");
  let profile: Profile | null = null;
  try {
    profile = await activeProfile();
    const profileId = profile.id;
    const timezone = profile.timezone;
    const supabase = await createClient();
    const { data: row, error: cardError } = await supabase.from("user_problem_cards").select("due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at,last_rating,version,first_attempted_at").eq("user_id", profileId).eq("problem_id", parsed.data.problemId).maybeSingle();
    if (cardError) return reviewFailure("temporary_failure", safeErrorMessage(cardError, "We could not load this problem."));
    const now = new Date();
    const current = row ? dbCard(row) : null;
    const eventKind: ReviewEventKind = !row ? "first_attempt" : isDueOnOrBeforeLocalDay(row.due_at, now, timezone) ? "scheduled_review" : "early_review";
    const next = cardStateForDatabase(scheduleCard(current, parsed.data.rating, now).next);
    const version = (row?.version ?? 0) + 1;
    const firstAttemptedAt = row?.first_attempted_at ?? now.toISOString();
    const nextSnapshot = { first_attempted_at: firstAttemptedAt, due_at: next.due_at, stability: next.stability, difficulty: next.difficulty, elapsed_days: next.elapsed_days, scheduled_days: next.scheduled_days, learning_steps: next.learning_steps, reps: next.reps, lapses: next.lapses, state: next.state, last_review_at: next.last_review_at, last_rating: parsed.data.rating, version };
    // The service RPC checks idempotency before locking a card, then returns
    // the exact saved result. That makes safe network retries one round-trip
    // cheaper and removes the old post-save reconciliation query.
    const { data, error } = await measure("review.rpc", () => createAdminClient().rpc("submit_review_result_service", {
      p_user_id: profileId, p_problem_id: parsed.data.problemId, p_request_id: parsed.data.requestId, p_rating: parsed.data.rating, p_reviewed_at: now.toISOString(), p_note: parsed.data.note ?? null, p_scheduler_version: SCHEDULER_VERSION, p_event_kind: eventKind, p_previous_due_at: row?.due_at ?? null, p_next_due_at: next.due_at, p_stability: next.stability, p_difficulty: next.difficulty, p_elapsed_days: next.elapsed_days, p_scheduled_days: next.scheduled_days, p_learning_steps: next.learning_steps, p_reps: next.reps, p_lapses: next.lapses, p_state: next.state, p_last_review_at: next.last_review_at, p_first_attempted_at: firstAttemptedAt, p_expected_version: row?.version ?? 0, p_previous_card_state: cardSnapshot(row), p_result_card_state: nextSnapshot, p_result_version: version,
    }));
    if (error) {
      const conflict = error.code === "40001" || error.code === "23505";
      if (conflict) return reviewConflictFailure(profileId, parsed.data.problemId, "This problem changed in another tab. Its latest schedule has been loaded; rate it again only if it is still due.");
      return reviewFailure(classifyActionError(error), safeErrorMessage(error, "We could not save this review. Please try again."));
    }
    // The active review session reconciles from this response, so do not invalidate its
    // route (which would cause a needless second queue fetch).
    revalidatePath("/today"); revalidatePath("/schedule"); revalidatePath("/progress"); revalidatePath("/problems/" + parsed.data.problemId);
    return reviewResultFromRpc(parsed.data.problemId, data as ReviewRpcPayload);
  } catch (error) {
    const code = classifyActionError(error);
    if (code === "conflict" && profile) return reviewConflictFailure(profile.id, parsed.data.problemId, "This problem changed in another tab. Its latest schedule has been loaded; rate it again only if it is still due.");
    return reviewFailure(code, safeErrorMessage(error, "We could not save this review. Please try again."));
  }
}

export async function undoReview(input: { reviewLogId: string; expectedVersion: number }): Promise<UndoReviewResult> {
  const parsed = z.object({ reviewLogId: z.string().uuid(), expectedVersion: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return reviewFailure("invalid_input", "This review cannot be undone.");
  try {
    const profile = await activeProfile();
    const { data, error } = await createAdminClient().rpc("undo_review_service", { p_user_id: profile.id, p_review_log_id: parsed.data.reviewLogId, p_expected_version: parsed.data.expectedVersion });
    if (error) return reviewFailure(classifyActionError(error), safeErrorMessage(error, "This review can no longer be undone."));
    const problemId = data?.problem_id as string;
    const previous = data?.previous_card_state as Record<string, any> | null;
    revalidatePath("/today"); revalidatePath("/schedule"); revalidatePath("/progress"); revalidatePath("/problems/" + problemId);
    const card = previous ? cardResult(problemId, previous) : null;
    return { ok: true, message: "Review undone.", problemId, card, retrievabilityNow: card ? retrievability(dbCard(previous!), new Date()) : null, ratingOptions: ratingOptions(card ? dbCard(previous!) : null) };
  } catch (error) { return reviewFailure(classifyActionError(error), safeErrorMessage(error, "This review can no longer be undone.")); }
}

export async function saveSettings(input: { displayName: string; timezone: string; selectedCatalog: string }): Promise<SaveSettingsResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a name, timezone, and valid study list." };
  try {
    const profile = await activeProfile();
    const { error } = await saveProfileSettings(profile, parsed.data, Boolean(profile.display_name));
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not save settings.") };
    revalidatePath("/today"); revalidatePath("/problems"); revalidatePath("/settings");
    return { ok: true, message: "Settings saved.", profile: { display_name: parsed.data.displayName, timezone: parsed.data.timezone, selected_catalog: parsed.data.selectedCatalog } };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not save settings.") }; }
}

const resetStudyProgressSchema = z.object({ confirmation: z.literal("RESET") });

/** Permanently removes only the active member's cards, logs, notes, and reversals. */
export async function resetStudyProgress(input: { confirmation: string }): Promise<ActionResult> {
  const parsed = resetStudyProgressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Type RESET exactly to confirm." };
  try {
    const profile = await activeProfile();
    const { error } = await createAdminClient().rpc("reset_study_progress_service", { p_user_id: profile.id });
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not reset your study progress. Please try again.") };
    revalidatePath("/today");
    revalidatePath("/review");
    revalidatePath("/schedule");
    revalidatePath("/progress");
    revalidatePath("/problems");
    revalidatePath("/problems/[problemId]", "page");
    return { ok: true, message: "Study progress reset. Your account and catalog were kept." };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not reset your study progress. Please try again.") }; }
}

export async function getSearchIndex(): Promise<Array<{ type: "problem" | "pattern"; title: string; subtitle: string; href: string }>> {
  const profile = await activeProfile();
  return getCatalogSearchIndex(profile.selected_catalog);
}

export async function loadProblemHistory(input: { problemId: string; before?: string }) {
  const parsed = z.object({ problemId: z.string().uuid(), before: z.string().max(512).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "The history cursor is invalid." };
  try { decodeHistoryCursor(parsed.data.before); } catch { return { ok: false as const, error: "The history cursor is invalid." }; }
  try {
    await activeProfile();
    const page = await getProblemHistoryPage(parsed.data.problemId, parsed.data.before);
    return { ok: true as const, ...page };
  } catch (error) {
    return { ok: false as const, error: safeErrorMessage(error, "We could not load older history.") };
  }
}

export interface AdminInviteRow { email: string; invited_at: string; claimed_at: string | null; is_active: boolean }
export type InviteUserResult = { ok: true; message: string; invite: AdminInviteRow } | { ok: false; error: string };
export type SetUserAccessResult = { ok: true; invite: AdminInviteRow } | { ok: false; error: string };

export async function inviteUser(email: string): Promise<InviteUserResult> {
  const normalized = z.string().trim().email().transform((value) => value.toLowerCase()).safeParse(email);
  if (!normalized.success) return { ok: false, error: "Enter a valid email address." };
  try {
    const profile = await activeProfile(); if (profile.role !== "admin") return { ok: false, error: "Only the app owner can invite people." };
    const admin = createAdminClient();
    const recent = await admin.from("allowed_emails").select("email", { count: "exact", head: true }).eq("invited_by", profile.id).gte("invited_at", new Date(Date.now() - 3600000).toISOString());
    if (recent.error) return { ok: false, error: safeErrorMessage(recent.error, "We could not check invitation limits.") };
    if ((recent.count ?? 0) >= 20) return { ok: false, error: "Too many invitations were sent recently. Please wait an hour." };
    const { data, error } = await admin.from("allowed_emails")
      .upsert({ email: normalized.data, invited_by: profile.id, is_active: true }, { onConflict: "email" })
      .select("email,invited_at,claimed_at,is_active")
      .single();
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not update the invitation.") };
    revalidatePath("/admin"); return { ok: true, message: normalized.data + " can now sign in with Google.", invite: data as AdminInviteRow };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not update the invitation.") }; }
}

export async function setUserAccess(email: string, isActive: boolean): Promise<SetUserAccessResult> {
  const parsed = z.string().trim().email().transform((value) => value.toLowerCase()).safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email address." };
  try {
    const profile = await activeProfile(); if (profile.role !== "admin") return { ok: false, error: "Only the app owner can manage access." };
    const { data, error } = await createAdminClient().from("allowed_emails")
      .update({ is_active: isActive })
      .eq("email", parsed.data)
      .select("email,invited_at,claimed_at,is_active")
      .single();
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not change access.") };
    revalidatePath("/admin"); return { ok: true, invite: data as AdminInviteRow };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not change access.") }; }
}
