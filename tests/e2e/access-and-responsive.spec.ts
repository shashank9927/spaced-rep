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

for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [844, 390], [320, 568]]) {
  for (const theme of ["dark", "light"]) {
    test(`mobile navigation ${width}x${height} ${theme} shows readable populated screens`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile" || !process.env.E2E_SUPABASE_URL);
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((value) => localStorage.setItem("recallcode-theme", value), theme);
      for (const [route, heading] of [["/today", "Today"], ["/problems", "Problems"], ["/schedule", "Schedule"], ["/progress", "Progress"]]) {
        await page.goto(route);
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), route).toBe(true);
      }
      await expect(page.getByRole("heading", { name: "Scheduled review outcomes", exact: true })).toBeVisible();
      await expect(page.getByRole("table", { name: "Scheduled review outcomes by local calendar week", includeHidden: true })).toBeAttached();
      await expect(page.getByRole("table", { name: "Review load for the next fourteen local days", includeHidden: true })).toBeAttached();
      await expect(page.getByRole("table", { name: "Days with recorded study activity", includeHidden: true })).toBeAttached();
      // Check after lazy chart hydration too: table intrinsic sizing can escape a
      // clipped table itself, so accessible equivalents need a clipped wrapper.
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await testInfo.attach("populated-progress", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await page.goto("/problems");
      await page.locator("main input[placeholder='Filter by number, title, or pattern']:visible").fill("Contains Duplicate");
      await page.getByRole("link", { name: /#217 Contains Duplicate/ }).click();
      const detail = page.getByRole("dialog", { name: "Contains Duplicate" });
      await detail.getByRole("button", { name: "More" }).click();
      await page.getByRole("menuitem", { name: "Review early" }).click();
      const cards = detail.locator("button").filter({ hasText: "Approx. next review" });
      await expect(cards).toHaveCount(4);
      expect(await cards.evaluateAll((buttons) => buttons.every((button) => {
        const description = button.children[1].getBoundingClientRect();
        const interval = button.children[2].getBoundingClientRect();
        return description.bottom <= interval.top && interval.bottom <= button.getBoundingClientRect().bottom;
      }))).toBe(true);
      await testInfo.attach("rating-cards", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });
  }
}
