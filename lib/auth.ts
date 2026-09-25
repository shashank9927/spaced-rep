import "server-only";

import { redirect } from "next/navigation";
import { cacheLife } from "next/cache";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { displayNameFromEmail } from "@/lib/utils";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requestCorrelationId } from "@/lib/security";
import { measure } from "@/lib/performance";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  timezone: string;
  selected_catalog: "neetcode150" | "neetcode250" | "allNC";
  role: "admin" | "member";
  is_active: boolean;
}

async function readSessionClaims() {
  "use cache: private";
  // This result is kept only in the signed-in browser's router cache. It is
  // never shared between members or persisted in a server data cache.
  cacheLife({ stale: 30 });
  const supabase = await createClient();
  const result = await measure("auth.claims", () => supabase.auth.getClaims());
  const claims = result.data?.claims;
  if (result.error || !claims?.sub) return null;
  return claims;
}

export const getSessionClaims = cache(readSessionClaims);

async function readProfile(): Promise<Profile | null> {
  "use cache: private";
  cacheLife({ stale: 30 });
  const claims = await getSessionClaims();
  if (!claims?.sub) return null;
  const supabase = await createClient();
  const { data } = await measure("profile.read", () => supabase.from("profiles")
    .select("id,email,display_name,timezone,selected_catalog,role,is_active")
    .eq("id", claims.sub)
    .maybeSingle());
  return data as Profile | null;
}

export const getProfile = cache(readProfile);

export async function requireProfile(options?: { onboarding?: boolean; admin?: boolean }): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (options?.admin && profile.role !== "admin") redirect("/today");
  if (!options?.onboarding && !profile.display_name) redirect("/onboarding");
  return profile;
}

export async function claimAuthenticatedUser(currentUser?: User | null) {
  const supabase = await createClient();
  const { data: { user: sessionUser } } = currentUser ? { data: { user: currentUser } } : await supabase.auth.getUser();
  const user = sessionUser;
  const correlationId = requestCorrelationId();
  const provider = user?.app_metadata?.provider;
  const isGoogleIdentity = provider === "google" || user?.identities?.some((identity) => identity.provider === "google");
  if (!user?.email || !isGoogleIdentity || !user.email_confirmed_at) {
    console.warn(`[auth:${correlationId}] rejected unverified or non-Google identity`);
    return { allowed: false, reason: "A verified Google account is required." };
  }

  const email = user.email.trim().toLowerCase();
  const admin = createAdminClient();
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();

  const { data: existing } = await admin.from("profiles").select("role,display_name,is_active").eq("id", user.id).maybeSingle();
  if (existing && !existing.is_active) {
    return { allowed: false, reason: "This account is disabled." };
  }

  const { data: allowed, error: allowedError } = await admin.from("allowed_emails").select("email,is_active,claimed_by").eq("email", email).maybeSingle();
  if (allowedError) {
    console.error(`[auth:${correlationId}] invitation lookup failed`, { code: allowedError.code });
    return { allowed: false, reason: "We could not verify your invitation." };
  }
  if (!allowed && email === bootstrapEmail) {
    const { error } = await admin.from("allowed_emails").insert({ email, claimed_by: user.id, claimed_at: new Date().toISOString(), is_active: true });
    if (error && error.code !== "23505") {
      console.error(`[auth:${correlationId}] bootstrap invitation failed`, { code: error.code });
      return { allowed: false, reason: "We could not verify the owner account." };
    }
  }
  const { data: currentInvite } = await admin.from("allowed_emails").select("email,is_active,claimed_by").eq("email", email).maybeSingle();
  const allowedRecord = currentInvite ?? allowed;
  if (allowedRecord?.claimed_by && allowedRecord.claimed_by !== user.id) return { allowed: false, reason: "This invitation belongs to another account." };
  if (!allowedRecord?.is_active) return { allowed: false, reason: "This Google account has not been invited." };
  const role = email === bootstrapEmail || existing?.role === "admin" ? "admin" : "member";
  const { error } = existing
    ? await admin.from("profiles").update({ email, role }).eq("id", user.id)
    : await admin.from("profiles").insert({ id: user.id, email, role, is_active: true, display_name: null });
  if (error) throw error;
  await admin.from("allowed_emails").update({ claimed_by: user.id, claimed_at: new Date().toISOString() }).eq("email", email);
  return { allowed: true, needsOnboarding: !existing?.display_name, suggestedName: displayNameFromEmail(email) };
}
