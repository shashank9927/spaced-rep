import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

// Do not load .env.local: these credentials must come from a disposable stack.
const url = process.env.E2E_SUPABASE_URL;
const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
if (!url || !key || !anonKey) throw new Error("Explicit isolated E2E credentials are required.");
const parsed = new URL(url);
if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || parsed.username || parsed.password) throw new Error("Database integration tests require a loopback Supabase instance.");
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const ok = (result) => { if (result.error) throw result.error; return result.data; };
const { data: problem, error } = await admin.from("problems").select("id").eq("leetcode_number", 1).single();
if (error) throw error;
const run = crypto.randomUUID();
const users = [];
for (const role of ["member", "member", "admin"]) {
  const email = `${role}-${users.length}-${run}@recallcode.test`;
  const password = `Test-${crypto.randomUUID()}!`;
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  ok(await admin.from("allowed_emails").insert({ email, claimed_by: user.id, is_active: true }));
  ok(await admin.from("profiles").insert({ id: user.id, email, display_name: "Integration", timezone: "Asia/Kolkata", selected_catalog: "neetcode150", role, is_active: true }));
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  ok(await client.auth.signInWithPassword({ email, password }));
  users.push({ id: user.id, email, client });
}
const [member, other, owner] = users;

async function card(user = member) {
  return ok(await admin.from("user_problem_cards").select("first_attempted_at,due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at,last_rating,version").eq("user_id", user.id).eq("problem_id", problem.id).maybeSingle());
}
async function submit({ user = member, request = crypto.randomUUID(), rating = "good", note = "private note", previous = null, kind = "first_attempt", at = new Date().toISOString() } = {}) {
  const next = { first_attempted_at: previous?.first_attempted_at ?? at, due_at: new Date(Date.parse(at) + 3 * 86400000).toISOString(), stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 3, learning_steps: 0, reps: (previous?.reps ?? 0) + 1, lapses: previous?.lapses ?? 0, state: 2, last_review_at: at, last_rating: rating, version: (previous?.version ?? 0) + 1 };
  return admin.rpc("submit_review_result_service", {
    p_user_id: user.id, p_problem_id: problem.id, p_request_id: request, p_rating: rating, p_reviewed_at: at, p_note: note, p_scheduler_version: "integration", p_event_kind: kind,
    p_previous_due_at: previous?.due_at ?? null, p_next_due_at: next.due_at, p_stability: next.stability, p_difficulty: next.difficulty, p_elapsed_days: 0, p_scheduled_days: 3, p_learning_steps: 0, p_reps: next.reps, p_lapses: next.lapses, p_state: 2, p_last_review_at: at, p_first_attempted_at: next.first_attempted_at, p_expected_version: previous?.version ?? 0, p_previous_card_state: previous, p_result_card_state: next, p_result_version: next.version,
  });
}
const undo = (event, user = member) => admin.rpc("undo_review_service", { p_user_id: user.id, p_review_log_id: event.review_log_id, p_expected_version: event.card.version });

const request = crypto.randomUUID();
const concurrent = await Promise.all([submit({ request }), submit({ request })]);
const first = ok(concurrent[0]);
const duplicate = ok(concurrent[1]);
assert.equal(first.review_log_id, duplicate.review_log_id, "Concurrent exact retries must share one event");
assert.equal(first.reviewed_at, duplicate.reviewed_at);
assert.deepEqual(first.card, duplicate.card);
assert.equal((await submit({ request, note: "changed" })).error?.code, "23505");
assert.equal((await submit({ request, rating: "hard" })).error?.code, "23505");
const previous = await card();
const racing = await Promise.all([submit({ previous, kind: "scheduled_review" }), submit({ previous, kind: "scheduled_review" })]);
assert.equal(racing.filter((result) => !result.error).length, 1, "Only one stale-version contender can commit");
assert.equal(racing.find((result) => result.error)?.error.code, "40001");
const scheduled = racing.find((result) => !result.error).data;
assert.equal((await undo(first)).error?.code, "40001", "An older review cannot be undone");
ok(await undo(scheduled));
assert.deepEqual(await card(), previous, "Undo restores the exact previous state");

// Private study data must stay private even from the owner.
for (const identity of [other, owner]) {
  assert.equal(ok(await identity.client.from("user_problem_cards").select("*").eq("user_id", member.id)).length, 0);
  assert.equal(ok(await identity.client.from("review_logs").select("*").eq("user_id", member.id)).length, 0);
  assert.equal(ok(await identity.client.from("review_reversals").select("*").eq("user_id", member.id)).length, 0);
}
for (const rpc of ["undo_review_service", "reset_study_progress_service"]) {
  const args = rpc === "undo_review_service" ? { p_user_id: member.id, p_review_log_id: first.review_log_id, p_expected_version: 1 } : { p_user_id: member.id };
  assert.ok((await member.client.rpc(rpc, args)).error, "Browser roles cannot invoke service operations");
}
const early = ok(await submit({ previous: await card(), kind: "early_review" }));
assert.equal(early.event_kind, "early_review");
ok(await undo(early));
ok(await undo(first));
assert.equal(await card(), null, "First-attempt Undo removes the card");
assert.equal((await submit({ request })).error?.code, "40001", "Retries cannot revive a reversed review");

const expired = ok(await submit({ at: new Date(Date.now() - 11 * 60000).toISOString() }));
assert.equal((await undo(expired)).error?.code, "40001", "Undo expires from the review timestamp");
ok(await admin.from("allowed_emails").update({ is_active: false }).eq("email", member.email));
assert.equal((await submit({ previous: await card(), kind: "early_review" })).error?.code, "42501");
assert.equal((await undo(expired)).error?.code, "42501");
assert.equal(ok(await member.client.from("user_problem_cards").select("*")).length, 0);
ok(await admin.from("allowed_emails").update({ is_active: true }).eq("email", member.email));
ok(await submit({ user: other }));
const otherCard = await card(other);
const profile = ok(await admin.from("profiles").select("*").eq("id", member.id).single());
ok(await admin.rpc("reset_study_progress_service", { p_user_id: member.id }));
ok(await admin.rpc("reset_study_progress_service", { p_user_id: member.id }));
for (const table of ["user_problem_cards", "review_logs", "review_reversals"]) assert.equal(ok(await admin.from(table).select("*").eq("user_id", member.id)).length, 0);
assert.deepEqual(await card(other), otherCard);
assert.deepEqual(ok(await admin.from("profiles").select("*").eq("id", member.id).single()), profile);
// A repeat catalog import must preserve stable IDs and existing user cards.
const idsBefore = ok(await admin.from("problems").select("id,source_id").order("source_id"));
execFileSync(process.execPath, ["scripts/import-catalog.mjs"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key },
  stdio: "inherit",
});
assert.deepEqual(ok(await admin.from("problems").select("id,source_id").order("source_id")), idsBefore);
assert.deepEqual(await card(other), otherCard);
console.log("PASS: concurrency, idempotency, stale versions, exact Undo, expiry, reversals, disabled access, RLS, admin privacy, and personal reset.");
