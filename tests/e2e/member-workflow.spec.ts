import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Route transitions can retain an outgoing tree briefly for animation and
// accessibility. Scope the interaction to the rendered deck input so a hidden
// prior tree never makes this test ambiguous.
const problemSearch = (page: import("@playwright/test").Page) =>
  page.locator("main input[placeholder='Filter by number, title, or pattern']:visible");

async function seedMemberDueReview() {
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

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "member");
  test.skip(!process.env.E2E_SUPABASE_URL, "Authenticated tests require the isolated Supabase test stack.");
});

test.describe.configure({ mode: "serial" });

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
  await expect(page.getByText("First attempt recorded").first()).toBeVisible();
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
  await expect(page.locator("main h2:has-text('Your learning data starts with one attempt.'):visible")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review load" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review outcomes" })).toBeVisible();
});
