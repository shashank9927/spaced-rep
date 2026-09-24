"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SCHEDULER_VERSION } from "@/lib/constants";
import { getProfile, type Profile } from "@/lib/auth";
import { cardStateForDatabase, scheduleCard } from "@/lib/scheduler";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { CATALOG_IDS, REVIEW_RATINGS, type CompleteUserProblemCard, type FsrsCardState, type ReviewEventKind, type SubmitReviewInput } from "@/lib/types";
import { safeErrorMessage, safeNoteSchema, timezoneSchema } from "@/lib/security";
import { isDueOnOrBeforeLocalDay } from "@/lib/study-plan";
import { leetcodeNumberFromSourceId } from "@/lib/utils";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
export type ReviewActionResult = {
  ok: true; reviewLogId: string; eventKind: ReviewEventKind; nextDue: string; reviewedAt: string;
  previousIntervalDays: number; newIntervalDays: number; note: string | null; card: CompleteUserProblemCard;
} | { ok: false; error: string; conflict?: boolean };

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
    revalidatePath("/problems"); revalidatePath("/today"); revalidatePath("/schedule");
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

async function existingResult(profile: Profile, problemId: string, requestId: string): Promise<ReviewActionResult | null> {
  const supabase = await createClient();
  const { data: log, error: logError } = await supabase.from("review_logs").select("id,problem_id,event_kind,next_due_at,scheduled_days,note").eq("user_id", profile.id).eq("request_id", requestId).maybeSingle();
  if (logError) throw logError;
  if (!log) return null;
  if (log.problem_id !== problemId) return { ok: false, error: "This request ID was already used for another review." };
  const { data: card, error: cardError } = await supabase.from("user_problem_cards").select("*").eq("user_id", profile.id).eq("problem_id", problemId).maybeSingle();
  if (cardError || !card) return { ok: false, error: "The saved review could not be reconciled. Please refresh." };
  return { ok: true, reviewLogId: log.id, eventKind: log.event_kind ?? "scheduled_review", nextDue: log.next_due_at, reviewedAt: card.last_review_at ?? new Date().toISOString(), previousIntervalDays: 0, newIntervalDays: log.scheduled_days, note: log.note ?? null, card: cardResult(problemId, card) };
}

export async function submitReview(input: SubmitReviewInput): Promise<ReviewActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The review data is invalid. Refresh and try again." };
  try {
    const profile = await activeProfile();
    const duplicate = await existingResult(profile, parsed.data.problemId, parsed.data.requestId);
    if (duplicate) return duplicate;
    const supabase = await createClient();
    const { data: row, error: cardError } = await supabase.from("user_problem_cards").select("*").eq("user_id", profile.id).eq("problem_id", parsed.data.problemId).maybeSingle();
    if (cardError) return { ok: false, error: safeErrorMessage(cardError, "We could not load this problem.") };
    const now = new Date();
    const current = row ? dbCard(row) : null;
    const eventKind: ReviewEventKind = !row ? "first_attempt" : isDueOnOrBeforeLocalDay(row.due_at, now, profile.timezone) ? "scheduled_review" : "early_review";
    const next = cardStateForDatabase(scheduleCard(current, parsed.data.rating, now).next);
    const version = (row?.version ?? 0) + 1;
    const firstAttemptedAt = row?.first_attempted_at ?? now.toISOString();
    const nextSnapshot = { first_attempted_at: firstAttemptedAt, due_at: next.due_at, stability: next.stability, difficulty: next.difficulty, elapsed_days: next.elapsed_days, scheduled_days: next.scheduled_days, learning_steps: next.learning_steps, reps: next.reps, lapses: next.lapses, state: next.state, last_review_at: next.last_review_at, last_rating: parsed.data.rating, version };
    const { data: reviewLogId, error } = await createAdminClient().rpc("submit_review_service", {
      p_user_id: profile.id, p_problem_id: parsed.data.problemId, p_request_id: parsed.data.requestId, p_rating: parsed.data.rating, p_reviewed_at: now.toISOString(), p_note: parsed.data.note ?? null, p_scheduler_version: SCHEDULER_VERSION, p_event_kind: eventKind, p_previous_due_at: row?.due_at ?? null, p_next_due_at: next.due_at, p_stability: next.stability, p_difficulty: next.difficulty, p_elapsed_days: next.elapsed_days, p_scheduled_days: next.scheduled_days, p_learning_steps: next.learning_steps, p_reps: next.reps, p_lapses: next.lapses, p_state: next.state, p_last_review_at: next.last_review_at, p_first_attempted_at: firstAttemptedAt, p_expected_version: row?.version ?? 0, p_previous_card_state: cardSnapshot(row), p_result_card_state: nextSnapshot, p_result_version: version,
    });
    if (error) {
      const conflict = error.code === "40001";
      return { ok: false, conflict, error: safeErrorMessage(error, conflict ? "This problem changed in another tab. Reload it, then rate again." : "We could not save this review. Please try again.") };
    }
    revalidatePath("/today"); revalidatePath("/review"); revalidatePath("/schedule"); revalidatePath("/progress"); revalidatePath("/problems/" + parsed.data.problemId);
    return { ok: true, reviewLogId, eventKind, nextDue: next.due_at, reviewedAt: now.toISOString(), previousIntervalDays: row?.scheduled_days ?? 0, newIntervalDays: next.scheduled_days, note: parsed.data.note?.trim() || null, card: { problemId: parsed.data.problemId, ...dbCard({ ...next, due_at: next.due_at }), dueAt: next.due_at, version, firstAttemptedAt, latestRating: parsed.data.rating } };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not save this review. Please try again.") }; }
}

export async function undoReview(input: { reviewLogId: string; expectedVersion: number }): Promise<ActionResult & { problemId?: string; card?: CompleteUserProblemCard | null }> {
  const parsed = z.object({ reviewLogId: z.string().uuid(), expectedVersion: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "This review cannot be undone." };
  try {
    const profile = await activeProfile();
    const { data, error } = await createAdminClient().rpc("undo_review_service", { p_user_id: profile.id, p_review_log_id: parsed.data.reviewLogId, p_expected_version: parsed.data.expectedVersion });
    if (error) return { ok: false, error: safeErrorMessage(error, "This review can no longer be undone.") };
    const problemId = data?.problem_id as string;
    const previous = data?.previous_card_state as Record<string, any> | null;
    revalidatePath("/today"); revalidatePath("/review"); revalidatePath("/schedule"); revalidatePath("/progress"); revalidatePath("/problems/" + problemId);
    return { ok: true, message: "Review undone.", problemId, card: previous ? cardResult(problemId, previous) : null };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "This review can no longer be undone.") }; }
}

export async function saveSettings(input: { displayName: string; timezone: string; selectedCatalog: string }): Promise<ActionResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a name, timezone, and valid study list." };
  try {
    const profile = await activeProfile();
    const { error } = await saveProfileSettings(profile, parsed.data, Boolean(profile.display_name));
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not save settings.") };
    revalidatePath("/today"); revalidatePath("/problems"); revalidatePath("/settings");
    return { ok: true, message: "Settings saved." };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not save settings.") }; }
}

export async function getSearchIndex(): Promise<Array<{ type: "problem" | "pattern"; title: string; subtitle: string; href: string }>> {
  const profile = await activeProfile(); const supabase = await createClient();
  const { data, error } = await supabase.from("catalog_problems").select("problems(id,source_id,title,difficulty,problem_topics(topics(name)))").eq("catalog_slug", profile.selected_catalog).order("sort_order");
  if (error) return [];
  const items = new Map<string, { type: "problem" | "pattern"; title: string; subtitle: string; href: string }>();
  for (const row of data ?? []) {
    const problem = Array.isArray((row as any).problems) ? (row as any).problems[0] : (row as any).problems;
    if (!problem?.id) continue;
    items.set("problem:" + problem.id, { type: "problem", title: "#" + leetcodeNumberFromSourceId(problem.source_id) + " " + problem.title, subtitle: problem.difficulty, href: "/problems/" + problem.id });
    for (const relation of problem.problem_topics ?? []) { const topic = Array.isArray(relation.topics) ? relation.topics[0] : relation.topics; if (topic?.name) items.set("pattern:" + topic.name, { type: "pattern", title: topic.name, subtitle: "Filter problem deck", href: "/problems?topic=" + encodeURIComponent(topic.name) }); }
  }
  return [...items.values()];
}

export async function inviteUser(email: string): Promise<ActionResult> {
  const normalized = z.string().trim().email().transform((value) => value.toLowerCase()).safeParse(email);
  if (!normalized.success) return { ok: false, error: "Enter a valid email address." };
  try {
    const profile = await activeProfile(); if (profile.role !== "admin") return { ok: false, error: "Only the app owner can invite people." };
    const admin = createAdminClient();
    const recent = await admin.from("allowed_emails").select("email", { count: "exact", head: true }).eq("invited_by", profile.id).gte("invited_at", new Date(Date.now() - 3600000).toISOString());
    if (recent.error) return { ok: false, error: safeErrorMessage(recent.error, "We could not check invitation limits.") };
    if ((recent.count ?? 0) >= 20) return { ok: false, error: "Too many invitations were sent recently. Please wait an hour." };
    const { error } = await admin.from("allowed_emails").upsert({ email: normalized.data, invited_by: profile.id, is_active: true }, { onConflict: "email" });
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not update the invitation.") };
    revalidatePath("/admin"); return { ok: true, message: normalized.data + " can now sign in with Google." };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not update the invitation.") }; }
}

export async function setUserAccess(email: string, isActive: boolean): Promise<ActionResult> {
  const parsed = z.string().trim().email().transform((value) => value.toLowerCase()).safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email address." };
  try {
    const profile = await activeProfile(); if (profile.role !== "admin") return { ok: false, error: "Only the app owner can manage access." };
    const { error } = await createAdminClient().from("allowed_emails").update({ is_active: isActive }).eq("email", parsed.data);
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not change access.") };
    revalidatePath("/admin"); return { ok: true };
  } catch (error) { return { ok: false, error: safeErrorMessage(error, "We could not change access.") }; }
}
