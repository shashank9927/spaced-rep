import { expect, test } from "./test";
import { createClient } from "@supabase/supabase-js";

// Route transitions can retain an outgoing tree briefly for animation and
// accessibility. Scope the interaction to the rendered deck input so a hidden
// prior tree never makes this test ambiguous.
const problemSearch = (page: import("@playwright/test").Page) =>
  page.locator("main input[placeholder='Filter by number, title, or pattern']:visible");

async function seedMemberDueReview() {
  await clearMemberProblem(217);
  const url = process.env.E2E_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const member = users.data.users.find((user) => user.email === "member@recallcode.test");
  const problem = await admin.from("problems").select("id").eq("leetcode_number", 217).single();
  if (users.error || !member || problem.error || !problem.data) throw users.error ?? problem.error ?? new Error("Could not seed the due review.");
  const attemptedAt = new Date(Date.now() - 4 * 86_400_000).toISOString();
  const dueAt = new Date(Date.now() - 86_400_000).toISOString();
  const card = await admin.from("user_problem_cards").upsert({
    user_id: member.id,
    problem_id: problem.data.id,
    first_attempted_at: attemptedAt,
    due_at: dueAt,
    stability: 3,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 3,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    last_review_at: attemptedAt,
    last_rating: "good",
    version: 1,
  }, { onConflict: "user_id,problem_id" });
  if (card.error) throw card.error;
}

/**
 * Browser retries reuse the same isolated database. Make tests which expect a
 * New problem independent of a previous failed attempt or a prior local run.
 */
async function clearMemberProblem(leetcodeNumber: number) {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const member = users.data.users.find((user) => user.email === "member@recallcode.test");
  const problem = await admin.from("problems").select("id").eq("leetcode_number", leetcodeNumber).single();
  if (users.error || !member || problem.error || !problem.data) throw users.error ?? problem.error ?? new Error("Could not reset the member test problem.");

  const logs = await admin.from("review_logs").select("id").eq("user_id", member.id).eq("problem_id", problem.data.id);
  if (logs.error) throw logs.error;
  const logIds = logs.data.map((log) => log.id);
  if (logIds.length) {
    const reversals = await admin.from("review_reversals").delete().in("review_log_id", logIds);
    if (reversals.error) throw reversals.error;
  }
  const deletedLogs = await admin.from("review_logs").delete().eq("user_id", member.id).eq("problem_id", problem.data.id);
  if (deletedLogs.error) throw deletedLogs.error;
  const deletedCard = await admin.from("user_problem_cards").delete().eq("user_id", member.id).eq("problem_id", problem.data.id);
  if (deletedCard.error) throw deletedCard.error;
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "member");
  test.skip(!process.env.E2E_SUPABASE_URL, "Authenticated tests require the isolated Supabase test stack.");
  // Each journey starts with the same data, including after Playwright retries.
  const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!);
  const users = await admin.auth.admin.listUsers();
  const member = users.data.users.find((user) => user.email === "member@recallcode.test");
  if (users.error || !member) throw users.error ?? new Error("Member fixture missing.");
  const reset = await admin.rpc("reset_study_progress_service", { p_user_id: member.id });
  if (reset.error) throw reset.error;
  const profile = await admin.from("profiles").update({ selected_catalog: "neetcode150", timezone: "Europe/Berlin", display_name: "member" }).eq("id", member.id);
  if (profile.error) throw profile.error;
  await seedMemberDueReview();
});

test.describe.configure({ mode: "default" });

test("primary navigation preserves the application shell", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.evaluate(() => { (window as typeof window & { __recallCodeShell?: string }).__recallCodeShell = "mounted"; });
  for (const [label, heading] of [["Problems", "Problems"], ["Schedule", "Schedule"], ["Progress", "Progress"]] as const) {
    await page.getByRole("link", { name: label, exact: true }).first().click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __recallCodeShell?: string }).__recallCodeShell)).toBe("mounted");
  }
});

test("a selected due review supports keyboard rating and exact Undo", async ({ page }) => {
  await seedMemberDueReview();
  await page.goto("/today");
  await page.locator("main a[href^='/review?problem=']:visible").first().click();
  await expect(page.getByRole("heading", { name: /review left/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contains Duplicate" })).toBeVisible();
  await page.keyboard.press("3");
  await expect(page.getByText("Review saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contains Duplicate" })).toBeVisible();
});

test("first attempt creates progress and Undo restores New", async ({ page }) => {
  await clearMemberProblem(1);
  await page.goto("/problems");
  await problemSearch(page).fill("Two Sum");
  await page.getByRole("link", { name: /#1 Two Sum/ }).click();
  const detailSheet = page.getByRole("dialog", { name: "Two Sum" });
  await expect(detailSheet.locator("h1", { hasText: "Two Sum" })).toBeVisible();
  await detailSheet.getByRole("button", { name: "Record first attempt" }).click();
  await detailSheet.getByRole("button", { name: /Good/ }).click();
  await expect(page.getByText(/Saved — next review/)).toBeVisible();
  await expect(detailSheet.getByText(/First attempt · Good/)).toBeVisible();
  await page.goto("/schedule");
  const agenda = page.locator("[data-schedule-agenda]");
  const attemptDay = agenda.locator('[data-schedule-agenda-day][data-populated="true"]').filter({ hasText: /first attempt/ }).first();
  await attemptDay.getByRole("button").click();
  await expect(attemptDay.getByText("First attempt recorded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("Review undone", { exact: true })).toBeVisible();
  await page.goto("/problems");
  await problemSearch(page).fill("Two Sum");
  await expect(page.getByRole("link", { name: /#1 Two Sum/ })).toContainText("New");
});

test("filters expose a clear recovery path", async ({ page }) => {
  await page.goto("/problems");
  await problemSearch(page).fill("no-such-problem-99999");
  await expect(page.getByText(/No problems match/)).toBeVisible();
  await page.getByRole("button", { name: "Reset all" }).click();
  await expect(page.getByText(/No problems match/)).toBeHidden();
});

for (const rating of ["Forgot", "Hard", "Good", "Easy"]) {
  test(`first attempt with ${rating} creates a scheduled card`, async ({ page }) => {
    await clearMemberProblem(1);
    await page.goto("/problems");
    await problemSearch(page).fill("Two Sum");
    await page.getByRole("link", { name: /#1 Two Sum/ }).click();
    const detail = page.getByRole("dialog", { name: "Two Sum" });
    const external = detail.getByRole("link", { name: "Open on LeetCode" });
    await expect(external).toHaveAttribute("href", /^https:\/\/leetcode\.com\//);
    await expect(detail.getByText("New", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Record first attempt" }).click();
    await detail.getByRole("button", { name: new RegExp(`^${rating} `) }).click();
    await expect(detail.getByText(`First attempt · ${rating}`, { exact: true })).toBeVisible();
    await expect(detail.getByText(/Saved — next review/)).toBeVisible();
    await expect(detail.getByRole("button", { name: "Record first attempt" })).toHaveCount(0);
    await detail.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Review early" }).click();
    await detail.getByRole("button", { name: /^Good / }).click();
    await expect(detail.getByText("Early review · Good", { exact: true })).toBeVisible();
  });
}

test("temporary save and Undo failures preserve safe retry state", async ({ page }) => {
  const requestIds: string[] = [];
  page.on("request", (request) => {
    const match = request.postData()?.match(/"requestId":"([a-f0-9-]+)"/i);
    if (match) requestIds.push(match[1]);
  });
  await page.goto("/today");
  await page.locator("main a[href^='/review?problem=']:visible").first().click();
  await expect(page.getByRole("heading", { name: "Contains Duplicate" })).toBeVisible();
  const abortAction = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) await route.abort("failed");
    else await route.continue();
  };
  await page.route("**/*", abortAction);
  await page.keyboard.press("3");
  await expect(page.getByText(/Could not reach the server/)).toBeVisible();
  await page.unroute("**/*", abortAction);
  await page.keyboard.press("3");
  await expect(page.getByText("Review saved", { exact: true })).toBeVisible();
  expect(requestIds).toHaveLength(2);
  expect(requestIds[0]).toBe(requestIds[1]);
  await page.route("**/*", abortAction);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText(/Could not reach the server/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  await page.unroute("**/*", abortAction);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contains Duplicate" })).toBeVisible();
});

test("settings synchronizes profile and preserves cards when the catalog changes", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Display name", { exact: true }).fill("Browser Member");
  await page.getByLabel("Timezone", { exact: true }).selectOption("Asia/Kolkata");
  await page.getByRole("button", { name: /NeetCode 250/ }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved.", { exact: true })).toBeVisible();
  await page.goto("/today");
  await expect(page.getByText("Contains Duplicate", { exact: true })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Browser Member");
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue("Asia/Kolkata");
});

test("schedule exposes fourteen days and a synchronized month view", async ({ page }) => {
  await page.goto("/schedule");
  const agenda = page.locator("[data-schedule-agenda]");
  await expect(agenda.locator("[data-schedule-agenda-day]")).toHaveCount(14);
  const populatedDay = agenda.locator('[data-schedule-agenda-day][data-populated="true"]').first();
  const details = populatedDay.locator('[role="region"]');
  await expect(populatedDay.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  await populatedDay.getByRole("button").click();
  await expect(populatedDay.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  await expect(details).toBeVisible();
  await populatedDay.getByRole("button").click();
  await expect(details).toBeHidden();
  await expect(agenda.locator('[data-schedule-agenda-day][data-populated="false"]').first().getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "Month overview" }).click();
  const month = page.locator("[data-schedule-month]");
  await expect(month.getByRole("button", { name: "Previous month" })).toBeVisible();
  await expect(month.getByRole("button", { name: "Next month" })).toBeVisible();
  await expect(month.locator("[data-schedule-month-detail]")).toBeVisible();
});

test("personal reset clears study data but keeps the account", async ({ page }) => {
  await clearMemberProblem(242);
  await page.goto("/problems");
  await problemSearch(page).fill("Valid Anagram");
  await page.getByRole("link", { name: /#242 Valid Anagram/ }).click();
  await page.getByRole("button", { name: "Record first attempt" }).click();
  await page.getByRole("button", { name: /Good/ }).click();
  await expect(page.getByText(/Saved — next review/)).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByLabel(/Type RESET/).fill("RESET");
  await page.getByRole("button", { name: "Permanently reset" }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.goto("/problems");
  await problemSearch(page).fill("Valid Anagram");
  await expect(page.getByRole("link", { name: /#242 Valid Anagram/ })).toContainText("New");
  await page.goto("/progress");
  await expect(page.locator("main h2:has-text('Your learning history starts with one attempt.'):visible")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review load" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Scheduled review outcomes" })).toHaveCount(0);
});

test("history paginates tied timestamps after 130 reversed events", async ({ page }) => {
  const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!);
  const { data: member, error: memberError } = await admin.from("profiles").select("id").eq("email", "member@recallcode.test").single();
  const { data: problem, error: problemError } = await admin.from("problems").select("id").eq("leetcode_number", 217).single();
  if (memberError || problemError || !member || !problem) throw memberError ?? problemError ?? new Error("History fixture unavailable.");
  const prefix = crypto.randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString();
  const entries = Array.from({ length: 155 }, (_, index) => ({ id: `${prefix}-0000-4000-8000-${String(1000 - index).padStart(12, "0")}`, user_id: member.id, problem_id: problem.id, request_id: crypto.randomUUID(), rating: "good", reviewed_at: timestamp, note: `history-note-${index}`, previous_due_at: timestamp, next_due_at: new Date(Date.now() + 86400000).toISOString(), scheduled_days: 1, scheduler_version: "e2e-history", event_kind: "scheduled_review", result_version: 1 }));
  const inserted = await admin.from("review_logs").insert(entries);
  if (inserted.error) throw inserted.error;
  const reversed = await admin.from("review_reversals").insert(entries.slice(0, 130).map((entry) => ({ user_id: member.id, review_log_id: entry.id })));
  if (reversed.error) throw reversed.error;
  await page.goto(`/problems/${problem.id}`);
  await expect(page.getByText("20 loaded", { exact: true })).toBeVisible();
  await expect(page.getByText("history-note-0", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Load older" }).click();
  await expect(page.getByText("25 loaded", { exact: true })).toBeVisible();
  await expect(page.getByText("history-note-154", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load older" })).toHaveCount(0);
});
