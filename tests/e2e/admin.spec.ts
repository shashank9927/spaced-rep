import { expect, test } from "@playwright/test";

test("admin invitation and row state update without reloading", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "admin" || !process.env.E2E_SUPABASE_URL);
  await page.goto("/admin");
  // A route may keep an outgoing tree in the document briefly. Interact with
  // the visible field in the active page rather than an inaccessible copy.
  await page.locator("main input[aria-label='Google email']:visible").fill("friend@recallcode.test");
  await page.getByRole("button", { name: "Allow access" }).click();
  const row = page.locator("main [data-testid='access-row-friend@recallcode.test']:visible");
  await expect(row).toContainText("Waiting to sign in");
  await row.getByRole("button", { name: "Disable" }).click();
  await expect(row).toContainText("Access disabled");
});
