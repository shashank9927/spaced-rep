"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SCHEDULER_VERSION } from "@/lib/constants";
import { getProfile, type Profile } from "@/lib/auth";
import { cardStateForDatabase, retrievability, scheduleCard } from "@/lib/scheduler";
import { createClient } from "@/lib/supabase/server";
import { leetcodeNumberFromSourceId } from "@/lib/utils";
import { CATALOG_IDS, PATTERN_RECALLS, REVIEW_RATINGS, STUDY_WEEKDAYS, type FsrsCardState, type ReviewRating, type StudyPlanPreferences, type SubmitReviewInput } from "@/lib/types";

export type ActionResult = { ok: true; message?: string; nextDue?: string } | { ok: false; error: string };
export type ReviewActionResult = {
  ok: true;
  nextDue: string;
  previousIntervalDays: number;
  newIntervalDays: number;
  previousRetrievability: number | null;
  newRetrievability: number;
  updatedCard: { problemId: string; dueAt: string; stability: number; lapses: number; repetitions: number; scheduledDays: number; firstSolvedAt: string };
} | { ok: false; error: string };

const studyPlanSchema = z.object({
  easyPerDay: z.number().int().min(0).max(10),
  mediumPerDay: z.number().int().min(0).max(10),
  hardPerDay: z.number().int().min(0).max(10),
  studyDays: z.array(z.enum(STUDY_WEEKDAYS)).min(1).max(7),
}).superRefine((value, context) => {
  if (value.easyPerDay + value.mediumPerDay + value.hardPerDay > 10) {
    context.addIssue({ code: "custom", message: "Keep the combined daily target at 10 problems or fewer." });
  }
});

const onboardingStudyPlanSchema = studyPlanSchema.superRefine((value, context) => {
  if (value.easyPerDay + value.mediumPerDay + value.hardPerDay < 1) {
    context.addIssue({ code: "custom", message: "Choose at least one new problem for each active study day." });
  }
});

async function activeProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new Error("You need to sign in again.");
  return profile;
}

export async function saveOnboarding(input: { displayName: string; timezone: string; selectedCatalog: string; studyPlan: Omit<StudyPlanPreferences, "configured"> }): Promise<ActionResult> {
  const parsed = z.object({
    displayName: z.string().trim().min(2).max(60),
    timezone: z.string().trim().min(1).max(80),
    selectedCatalog: z.enum(CATALOG_IDS),
    studyPlan: onboardingStudyPlanSchema,
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please enter a name and select a valid study list." };

  const profile = await activeProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    timezone: parsed.data.timezone,
    selected_catalog: parsed.data.selectedCatalog,
    new_easy_per_day: parsed.data.studyPlan.easyPerDay,
    new_medium_per_day: parsed.data.studyPlan.mediumPerDay,
    new_hard_per_day: parsed.data.studyPlan.hardPerDay,
    study_days: parsed.data.studyPlan.studyDays,
    study_plan_configured_at: new Date().toISOString(),
  }).eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setActiveCatalog(selectedCatalog: string): Promise<ActionResult> {
  const catalog = z.enum(CATALOG_IDS).safeParse(selectedCatalog);
  if (!catalog.success) return { ok: false, error: "Unknown catalog." };
  const profile = await activeProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ selected_catalog: catalog.data }).eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/catalog");
  revalidatePath("/problems");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}

const reviewSchema = z.object({
  problemId: z.string().uuid(),
  rating: z.enum(REVIEW_RATINGS),
  note: z.string().trim().max(2000).optional().default(""),
  durationMinutes: z.number().int().min(1).max(300).optional(),
  patternRecall: z.enum(PATTERN_RECALLS).optional(),
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
  const profile = await activeProfile();
  const supabase = await createClient();
  const { data: row, error: cardError } = await supabase
    .from("user_problem_cards")
    .select("*")
    .eq("user_id", profile.id)
    .eq("problem_id", parsed.data.problemId)
    .maybeSingle();
  if (cardError) return { ok: false, error: cardError.message };

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
  const { error } = await supabase.rpc("submit_review", {
    p_problem_id: parsed.data.problemId,
    p_request_id: parsed.data.requestId,
    p_rating: parsed.data.rating,
    p_reviewed_at: now.toISOString(),
    p_note: parsed.data.note,
    p_duration_minutes: parsed.data.durationMinutes ?? null,
    p_pattern_recall: parsed.data.patternRecall ?? null,
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
    p_first_solved_at: row?.first_solved_at ?? now.toISOString(),
    p_expected_version: row?.version ?? 0,
  });
  if (error) {
    const isStale = error.message.toLowerCase().includes("stale card");
    return { ok: false, error: isStale ? "This problem was updated in another tab. Refresh to continue." : error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/problems");
  revalidatePath(`/problems/${parsed.data.problemId}`);
  revalidatePath("/schedule");
  revalidatePath("/insights");
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
      firstSolvedAt: row?.first_solved_at ?? now.toISOString(),
    },
  };
}

export async function saveStudyPlanPreferences(input: Omit<StudyPlanPreferences, "configured">): Promise<ActionResult> {
  const parsed = studyPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your study plan." };
  const profile = await activeProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    new_easy_per_day: parsed.data.easyPerDay,
    new_medium_per_day: parsed.data.mediumPerDay,
    new_hard_per_day: parsed.data.hardPerDay,
    study_days: parsed.data.studyDays,
    study_plan_configured_at: new Date().toISOString(),
  }).eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  revalidatePath("/settings");
  return { ok: true, message: "Study plan saved." };
}

export async function saveSettings(input: { displayName: string; timezone: string; selectedCatalog: string }): Promise<ActionResult> {
  const parsed = z.object({
    displayName: z.string().trim().min(2).max(60),
    timezone: z.string().trim().min(1).max(80),
    selectedCatalog: z.enum(CATALOG_IDS),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a name, timezone, and valid study list." };
  const profile = await activeProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    timezone: parsed.data.timezone,
    selected_catalog: parsed.data.selectedCatalog,
  }).eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
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
      if (topic?.name) items.set(`pattern:${topic.name}`, { type: "pattern", title: topic.name, subtitle: "Pattern insight", href: "/insights" });
    }
  }
  return [...items.values()];
}

export async function inviteUser(email: string): Promise<ActionResult> {
  const normalized = z.string().trim().email().transform((value) => value.toLowerCase()).safeParse(email);
  if (!normalized.success) return { ok: false, error: "Enter a valid email address." };
  const profile = await activeProfile();
  if (profile.role !== "admin") return { ok: false, error: "Only the app owner can invite people." };
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_emails").upsert({
    email: normalized.data,
    invited_by: profile.id,
    is_active: true,
  }, { onConflict: "email" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true, message: `${normalized.data} can now sign in with Google.` };
}

export async function setUserAccess(email: string, isActive: boolean): Promise<ActionResult> {
  const parsed = z.string().trim().email().transform((value) => value.toLowerCase()).safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email address." };
  const profile = await activeProfile();
  if (profile.role !== "admin") return { ok: false, error: "Only the app owner can manage access." };
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_emails").update({ is_active: isActive }).eq("email", parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
