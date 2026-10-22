import { expect, test } from "./test";

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
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(row).toContainText("Waiting to sign in");
  const abortAction = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) await route.abort("failed");
    else await route.continue();
  };
  await page.route("**/*", abortAction);
  await row.getByRole("button", { name: "Disable" }).click();
  await expect(page.getByText("Could not change access. Try again.")).toBeVisible();
  await expect(row).toContainText("Waiting to sign in");
  await expect(row.getByRole("button", { name: "Disable" })).toBeEnabled();
});
