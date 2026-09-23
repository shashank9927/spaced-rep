"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SCHEDULER_VERSION } from "@/lib/constants";
import { getProfile, type Profile } from "@/lib/auth";
import { cardStateForDatabase, scheduleCard } from "@/lib/scheduler";
import { createClient } from "@/lib/supabase/server";
import { CATALOG_IDS, REVIEW_RATINGS, type FsrsCardState, type ReviewRating } from "@/lib/types";

type ActionResult = { ok: true; message?: string; nextDue?: string } | { ok: false; error: string };

async function activeProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new Error("You need to sign in again.");
  return profile;
}

export async function saveOnboarding(input: { displayName: string; timezone: string; selectedCatalog: string }): Promise<ActionResult> {
  const parsed = z.object({
    displayName: z.string().trim().min(2).max(60),
    timezone: z.string().trim().min(1).max(80),
    selectedCatalog: z.enum(CATALOG_IDS),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please enter a name and select a valid study list." };

  const profile = await activeProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    timezone: parsed.data.timezone,
    selected_catalog: parsed.data.selectedCatalog,
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
  revalidatePath("/dashboard");
  return { ok: true };
}

const reviewSchema = z.object({
  problemId: z.string().uuid(),
  rating: z.enum(REVIEW_RATINGS),
  note: z.string().trim().max(2000).optional().default(""),
  requestId: z.string().uuid().optional(),
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

export async function submitReview(input: z.infer<typeof reviewSchema>): Promise<ActionResult> {
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
  const { error } = await supabase.rpc("submit_review", {
    p_problem_id: parsed.data.problemId,
    p_request_id: parsed.data.requestId ?? randomUUID(),
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
    p_first_solved_at: row?.first_solved_at ?? now.toISOString(),
    p_expected_version: row?.version ?? 0,
  });
  if (error) {
    const isStale = error.message.toLowerCase().includes("stale card");
    return { ok: false, error: isStale ? "This problem was updated in another tab. Refresh to continue." : error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  revalidatePath("/review");
  revalidatePath("/history");
  return { ok: true, nextDue: next.due_at };
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
