import { expect, test } from "./test";

test("disabled membership is rejected on its next request", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "disabled" || !process.env.E2E_SUPABASE_URL);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});

test("mobile navigation and layout do not overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile" || !process.env.E2E_SUPABASE_URL);
  await page.goto("/today");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).last()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.getByRole("link", { name: "Problems", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Problems" })).toBeVisible();
});
