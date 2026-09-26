import { mkdir, writeFile } from "node:fs/promises";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type TestIdentity = { email: string; password: string; role: "admin" | "member"; active: boolean; file: string };
const identities: TestIdentity[] = [
  { email: "owner@recallcode.test", password: "RecallCode-owner-2026!", role: "admin", active: true, file: "admin.json" },
  { email: "member@recallcode.test", password: "RecallCode-member-2026!", role: "member", active: true, file: "member.json" },
  { email: "mobile@recallcode.test", password: "RecallCode-mobile-2026!", role: "member", active: true, file: "mobile.json" },
  { email: "disabled@recallcode.test", password: "RecallCode-disabled-2026!", role: "member", active: false, file: "disabled.json" },
];

export default async function globalSetup() {
  await mkdir(".playwright/auth", { recursive: true });
  const url = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.E2E_SUPABASE_URL || !url || !anonKey || !serviceKey) {
    await Promise.all(identities.map((identity) => writeState(identity.file, [])));
    return;
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existing.error) throw existing.error;
  const testEmails = new Set(identities.map((identity) => identity.email));
  for (const user of existing.data.users.filter((candidate) => candidate.email && testEmails.has(candidate.email))) {
    const removed = await admin.auth.admin.deleteUser(user.id);
    if (removed.error) throw removed.error;
  }
  const userIds = new Map<string, string>();
  for (const identity of identities) {
    const created = await admin.auth.admin.createUser({
      email: identity.email,
      password: identity.password,
      email_confirm: true,
      app_metadata: { provider: "google", providers: ["google"] },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error(`Could not seed ${identity.email}`);
    const userId = created.data.user.id;
    userIds.set(identity.email, userId);
    const { error: inviteError } = await admin.from("allowed_emails").upsert({ email: identity.email, claimed_by: userId, claimed_at: new Date().toISOString(), is_active: identity.active }, { onConflict: "email" });
    if (inviteError) throw inviteError;
    const { error: profileError } = await admin.from("profiles").upsert({ id: userId, email: identity.email, display_name: identity.email.split("@")[0], timezone: "Europe/Berlin", selected_catalog: "neetcode150", role: identity.role, is_active: identity.active, onboarding_completed_at: new Date().toISOString() }, { onConflict: "id" });
    if (profileError) throw profileError;
    await writeState(identity.file, await sessionCookies(url, anonKey, identity.email, identity.password));
  }
  const memberId = userIds.get("member@recallcode.test");
  const { data: dueProblem, error: problemError } = await admin.from("problems").select("id").eq("leetcode_number", 217).single();
  if (!memberId || problemError || !dueProblem) throw problemError ?? new Error("Could not seed due review problem");
  const attemptedAt = new Date(Date.now() - 4 * 86_400_000).toISOString();
  const dueAt = new Date(Date.now() - 86_400_000).toISOString();
  const card = { first_attempted_at: attemptedAt, due_at: dueAt, stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 3, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review_at: attemptedAt, last_rating: "good", version: 1 };
  const { error: cardError } = await admin.from("user_problem_cards").insert({ user_id: memberId, problem_id: dueProblem.id, ...card });
  if (cardError) throw cardError;
  const { error: logError } = await admin.from("review_logs").insert({ user_id: memberId, problem_id: dueProblem.id, request_id: crypto.randomUUID(), rating: "good", reviewed_at: attemptedAt, previous_due_at: null, next_due_at: dueAt, scheduled_days: 3, scheduler_version: "e2e-seed", event_kind: "first_attempt", previous_card_state: null, result_card_state: card, result_version: 1 });
  if (logError) throw logError;
}

async function sessionCookies(url: string, anonKey: string, email: string, password: string) {
  let saved: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (items) => { saved = items; },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const appUrl = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000");
  return saved.map(({ name, value, options }) => ({
    name,
    value,
    domain: appUrl.hostname,
    path: options.path ?? "/",
    expires: typeof options.maxAge === "number" ? Math.floor(Date.now() / 1000) + options.maxAge : -1,
    httpOnly: options.httpOnly ?? false,
    secure: appUrl.protocol === "https:",
    sameSite: options.sameSite === "strict" ? "Strict" as const : options.sameSite === "none" ? "None" as const : "Lax" as const,
  }));
}

async function writeState(file: string, cookies: unknown[]) {
  await writeFile(`.playwright/auth/${file}`, JSON.stringify({ cookies, origins: [] }), "utf8");
}
