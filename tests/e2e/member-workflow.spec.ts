import { expect, test } from "@playwright/test";

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
  await page.goto("/today");
  const dueRow = page.getByText("Contains Duplicate", { exact: true }).locator("xpath=../..");
  await dueRow.getByRole("link", { name: "Review" }).click();
  await expect(page.getByRole("heading", { name: /review left/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contains Duplicate" })).toBeVisible();
  await page.keyboard.press("3");
  await expect(page.getByText("Review saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contains Duplicate" })).toBeVisible();
});

test("first attempt creates progress and Undo restores New", async ({ page }) => {
  await page.goto("/problems");
  await page.getByPlaceholder("Filter by number, title, or pattern").fill("Two Sum");
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
  await page.getByPlaceholder("Filter by number, title, or pattern").fill("Two Sum");
  await expect(page.getByRole("link", { name: /#1 Two Sum/ })).toContainText("New");
});

test("filters expose a clear recovery path", async ({ page }) => {
  await page.goto("/problems");
  await page.getByPlaceholder("Filter by number, title, or pattern").fill("no-such-problem-99999");
  await expect(page.getByText(/No problems match/)).toBeVisible();
  await page.getByRole("button", { name: "Reset all" }).click();
  await expect(page.getByText(/No problems match/)).toBeHidden();
});

test("schedule exposes fourteen days and a synchronized month view", async ({ page }) => {
  await page.goto("/schedule");
  const agenda = page.getByRole("heading", { name: "Next 14 days" }).locator("..").locator("..");
  await expect(agenda.getByRole("button")).toHaveCount(14);
  await page.getByRole("button", { name: "Month overview" }).click();
  await expect(page.getByRole("button", { name: "Previous month" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
});

test("personal reset clears study data but keeps the account", async ({ page }) => {
  await page.goto("/problems");
  await page.getByPlaceholder("Filter by number, title, or pattern").fill("Valid Anagram");
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
  await page.getByPlaceholder("Filter by number, title, or pattern").fill("Valid Anagram");
  await expect(page.getByRole("link", { name: /#242 Valid Anagram/ })).toContainText("New");
  await page.goto("/progress");
  await expect(page.getByText("Your learning data starts with one attempt.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review load" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review outcomes" })).toBeVisible();
});
