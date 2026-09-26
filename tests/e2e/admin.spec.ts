import { expect, test } from "@playwright/test";

test("admin invitation and row state update without reloading", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "admin" || !process.env.E2E_SUPABASE_URL);
  await page.goto("/admin");
  await page.getByLabel("Google email").fill("friend@recallcode.test");
  await page.getByRole("button", { name: "Allow access" }).click();
  const row = page.getByTestId("access-row-friend@recallcode.test");
  await expect(row).toContainText("Waiting to sign in");
  await row.getByRole("button", { name: "Disable" }).click();
  await expect(row).toContainText("Access disabled");
});
