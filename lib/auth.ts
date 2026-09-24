import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { StudyWeekday } from "@/lib/types";
import { displayNameFromEmail } from "@/lib/utils";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  timezone: string;
  selected_catalog: "neetcode150" | "neetcode250" | "allNC";
  role: "admin" | "member";
  is_active: boolean;
  new_easy_per_day: number;
  new_medium_per_day: number;
  new_hard_per_day: number;
  study_days: StudyWeekday[];
  study_plan_configured_at: string | null;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data as Profile | null;
});

export async function requireProfile(options?: { onboarding?: boolean; admin?: boolean }): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (options?.admin && profile.role !== "admin") redirect("/dashboard");
  if (!options?.onboarding && !profile.display_name) redirect("/onboarding");
  return profile;
}

export async function claimAuthenticatedUser(currentUser?: User | null) {
  const supabase = await createClient();
  const { data: { user: sessionUser } } = currentUser ? { data: { user: currentUser } } : await supabase.auth.getUser();
  const user = sessionUser;
  if (!user?.email) return { allowed: false, reason: "No email was returned by Google." };

  const email = user.email.trim().toLowerCase();
  const admin = createAdminClient();
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();

  if (email === bootstrapEmail) {
    await admin.from("allowed_emails").upsert({ email, claimed_by: user.id, claimed_at: new Date().toISOString(), is_active: true }, { onConflict: "email" });
  }

  const { data: allowed } = await admin.from("allowed_emails").select("email,is_active").eq("email", email).maybeSingle();
  if (!allowed?.is_active) return { allowed: false, reason: "This Google account has not been invited." };

  const { data: existing } = await admin.from("profiles").select("role,display_name").eq("id", user.id).maybeSingle();
  const role = email === bootstrapEmail || existing?.role === "admin" ? "admin" : "member";
  const { error } = await admin.from("profiles").upsert({
    id: user.id,
    email,
    role,
    is_active: true,
    display_name: existing?.display_name ?? null,
  });
  if (error) throw error;
  await admin.from("allowed_emails").update({ claimed_by: user.id, claimed_at: new Date().toISOString() }).eq("email", email);
  return { allowed: true, needsOnboarding: !existing?.display_name, suggestedName: displayNameFromEmail(email) };
}
