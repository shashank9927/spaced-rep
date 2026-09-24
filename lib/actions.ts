"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SCHEDULER_VERSION } from "@/lib/constants";
import { getProfile, type Profile } from "@/lib/auth";
import { cardStateForDatabase, retrievability, scheduleCard } from "@/lib/scheduler";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { leetcodeNumberFromSourceId } from "@/lib/utils";
import { CATALOG_IDS, REVIEW_RATINGS, type FsrsCardState, type ReviewRating, type SubmitReviewInput } from "@/lib/types";
import { safeErrorMessage, safeNoteSchema, timezoneSchema } from "@/lib/security";

export type ActionResult = { ok: true; message?: string; nextDue?: string } | { ok: false; error: string };
export type ReviewActionResult = {
  ok: true;
  nextDue: string;
  previousIntervalDays: number;
  newIntervalDays: number;
  previousRetrievability: number | null;
  newRetrievability: number;
  updatedCard: { problemId: string; dueAt: string; stability: number; lapses: number; repetitions: number; scheduledDays: number; firstAttemptedAt: string };
} | { ok: false; error: string };

async function activeProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new Error("You need to sign in again.");
  return profile;
}

const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  timezone: timezoneSchema,
  selectedCatalog: z.enum(CATALOG_IDS),
});

async function saveProfileSettings(profile: Profile, input: z.infer<typeof profileSettingsSchema>, onboardingCompleted: boolean) {
  const admin = createAdminClient();
  return admin.rpc("save_profile_settings_internal", {
    p_user_id: profile.id,
    p_display_name: input.displayName,
    p_timezone: input.timezone,
    p_selected_catalog: input.selectedCatalog,
    p_onboarding_completed: onboardingCompleted,
  });
}

export async function saveOnboarding(input: { displayName: string; timezone: string; selectedCatalog: string }): Promise<ActionResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please enter a name and select a valid study list." };
  try {
    const profile = await activeProfile();
    const { error } = await saveProfileSettings(profile, parsed.data, true);
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not save onboarding. Please try again.") };
    revalidatePath("/today");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: safeErrorMessage(error, "We could not save onboarding. Please try again.") };
  }
}

export async function setActiveCatalog(selectedCatalog: string): Promise<ActionResult> {
  const catalog = z.enum(CATALOG_IDS).safeParse(selectedCatalog);
  if (!catalog.success) return { ok: false, error: "Unknown catalog." };
  try {
    const profile = await activeProfile();
    const { error } = await saveProfileSettings(profile, { displayName: profile.display_name ?? "RecallCode user", timezone: profile.timezone, selectedCatalog: catalog.data }, Boolean(profile.display_name));
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not change the catalog.") };
  } catch (error) {
    return { ok: false, error: safeErrorMessage(error, "We could not change the catalog.") };
  }
  revalidatePath("/catalog");
  revalidatePath("/problems");
  revalidatePath("/today");
  revalidatePath("/schedule");
  return { ok: true };
}

const reviewSchema = z.object({
  problemId: z.string().uuid(),
  rating: z.enum(REVIEW_RATINGS),
    note: safeNoteSchema,
  requestId: z.string().uuid(),
});

function dbCard(row: any): FsrsCardState {
  return {
    due: row.due_at,
    stability: Number(row.stability),
    difficulty: Number(row.difficulty),
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review_at,
  };
}

export async function submitReview(input: SubmitReviewInput): Promise<ReviewActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The review data is invalid. Refresh and try again." };
  try {
    const profile = await activeProfile();
    const supabase = await createClient();
    const { data: existingLog, error: existingLogError } = await supabase
      .from("review_logs")
      .select("problem_id,rating,next_due_at,scheduled_days")
      .eq("user_id", profile.id)
      .eq("request_id", parsed.data.requestId)
      .maybeSingle();
    if (existingLogError) return { ok: false, error: safeErrorMessage(existingLogError, "We could not verify this review. Please try again.") };
    if (existingLog && (existingLog.problem_id !== parsed.data.problemId || existingLog.rating !== parsed.data.rating)) {
      return { ok: false, error: "This request ID was already used for a different review." };
    }
    if (existingLog) {
      const { data: existingCard, error: existingCardError } = await supabase.from("user_problem_cards").select("*").eq("user_id", profile.id).eq("problem_id", parsed.data.problemId).maybeSingle();
      if (existingCardError || !existingCard) return { ok: false, error: "Your saved review could not be reconciled. Refresh and try again." };
      return {
        ok: true,
        nextDue: existingLog.next_due_at,
        previousIntervalDays: 0,
        newIntervalDays: existingLog.scheduled_days,
        previousRetrievability: null,
        newRetrievability: retrievability(dbCard(existingCard), new Date()),
        updatedCard: { problemId: parsed.data.problemId, dueAt: existingLog.next_due_at, stability: Number(existingCard.stability), lapses: existingCard.lapses, repetitions: existingCard.reps, scheduledDays: existingLog.scheduled_days, firstAttemptedAt: existingCard.first_attempted_at },
      };
    }
    const { data: row, error: cardError } = await supabase
      .from("user_problem_cards")
      .select("*")
      .eq("user_id", profile.id)
      .eq("problem_id", parsed.data.problemId)
      .maybeSingle();
    if (cardError) return { ok: false, error: safeErrorMessage(cardError, "We could not load this problem. Please try again.") };

  const now = new Date();
  const current = row ? dbCard(row) : null;
  const scheduled = scheduleCard(current, parsed.data.rating as ReviewRating, now);
  const next = cardStateForDatabase(scheduled.next);
  const previousRetrievability = current ? retrievability(current, now) : null;
  const newRetrievability = retrievability({
    due: next.due_at,
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days,
    learning_steps: next.learning_steps,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    last_review: next.last_review_at,
  }, now);
  const admin = createAdminClient();
  const { error } = await admin.rpc("submit_review_internal", {
    p_user_id: profile.id,
    p_problem_id: parsed.data.problemId,
    p_request_id: parsed.data.requestId,
    p_rating: parsed.data.rating,
    p_reviewed_at: now.toISOString(),
    p_note: parsed.data.note,
    p_scheduler_version: SCHEDULER_VERSION,
    p_previous_due_at: row?.due_at ?? null,
    p_next_due_at: next.due_at,
    p_stability: next.stability,
    p_difficulty: next.difficulty,
    p_elapsed_days: next.elapsed_days,
    p_scheduled_days: next.scheduled_days,
    p_learning_steps: next.learning_steps,
    p_reps: next.reps,
    p_lapses: next.lapses,
    p_state: next.state,
    p_last_review_at: next.last_review_at,
    p_first_attempted_at: row?.first_attempted_at ?? now.toISOString(),
    p_expected_version: row?.version ?? 0,
  });
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not save this review. Please try again.") };

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath(`/problems/${parsed.data.problemId}`);
  revalidatePath("/schedule");
  revalidatePath("/progress");
    return {
    ok: true,
    nextDue: next.due_at,
    previousIntervalDays: row?.scheduled_days ?? 0,
    newIntervalDays: next.scheduled_days,
    previousRetrievability,
    newRetrievability,
    updatedCard: {
      problemId: parsed.data.problemId,
      dueAt: next.due_at,
      stability: next.stability,
      lapses: next.lapses,
      repetitions: next.reps,
      scheduledDays: next.scheduled_days,
      firstAttemptedAt: row?.first_attempted_at ?? now.toISOString(),
    },
    };
  } catch (error) {
    return { ok: false, error: safeErrorMessage(error, "We could not save this review. Please try again.") };
  }
}

export async function saveSettings(input: { displayName: string; timezone: string; selectedCatalog: string }): Promise<ActionResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a name, timezone, and valid study list." };
  try {
    const profile = await activeProfile();
    const { error } = await saveProfileSettings(profile, parsed.data, Boolean(profile.display_name));
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not save settings.") };
  } catch (error) {
    return { ok: false, error: safeErrorMessage(error, "We could not save settings.") };
  }
  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/settings");
  return { ok: true, message: "Settings saved." };
}

export async function getSearchIndex(): Promise<Array<{ type: "problem" | "pattern"; title: string; subtitle: string; href: string }>> {
  const profile = await activeProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from("catalog_problems")
    .select("problems(id,source_id,title,difficulty,problem_topics(topics(name)))")
    .eq("catalog_slug", profile.selected_catalog)
    .order("sort_order");
  if (error) return [];
  const items = new Map<string, { type: "problem" | "pattern"; title: string; subtitle: string; href: string }>();
  for (const row of data ?? []) {
    const problem = Array.isArray((row as any).problems) ? (row as any).problems[0] : (row as any).problems;
    if (!problem?.id) continue;
    items.set(`problem:${problem.id}`, { type: "problem", title: `#${leetcodeNumberFromSourceId(problem.source_id)} ${problem.title}`, subtitle: problem.difficulty, href: `/problems/${problem.id}` });
    for (const relation of problem.problem_topics ?? []) {
      const topic = Array.isArray(relation.topics) ? relation.topics[0] : relation.topics;
      if (topic?.name) items.set(`pattern:${topic.name}`, { type: "pattern", title: topic.name, subtitle: "Filter problem deck", href: `/problems?topic=${encodeURIComponent(topic.name)}` });
    }
  }
  return [...items.values()];
}

export async function inviteUser(email: string): Promise<ActionResult> {
  const normalized = z.string().trim().email().transform((value) => value.toLowerCase()).safeParse(email);
  if (!normalized.success) return { ok: false, error: "Enter a valid email address." };
  try {
    const profile = await activeProfile();
    if (profile.role !== "admin") return { ok: false, error: "Only the app owner can invite people." };
    const admin = createAdminClient();
    const recent = await admin.from("allowed_emails").select("email", { count: "exact", head: true }).eq("invited_by", profile.id).gte("invited_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (recent.error) return { ok: false, error: safeErrorMessage(recent.error, "We could not check invitation limits.") };
    if ((recent.count ?? 0) >= 20) return { ok: false, error: "Too many invitations were sent recently. Please wait an hour." };
    const { error } = await admin.from("allowed_emails").upsert({
      email: normalized.data,
      invited_by: profile.id,
      is_active: true,
    }, { onConflict: "email" });
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not update the invitation.") };
    revalidatePath("/admin");
    return { ok: true, message: `${normalized.data} can now sign in with Google.` };
  } catch (error) {
    return { ok: false, error: safeErrorMessage(error, "We could not update the invitation.") };
  }
}

export async function setUserAccess(email: string, isActive: boolean): Promise<ActionResult> {
  const parsed = z.string().trim().email().transform((value) => value.toLowerCase()).safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email address." };
  try {
    const profile = await activeProfile();
    if (profile.role !== "admin") return { ok: false, error: "Only the app owner can manage access." };
    const admin = createAdminClient();
    const { error } = await admin.from("allowed_emails").update({ is_active: isActive }).eq("email", parsed.data);
    if (error) return { ok: false, error: safeErrorMessage(error, "We could not change access.") };
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: safeErrorMessage(error, "We could not change access.") };
  }
}
