import { expect, test } from "./test";

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "public"));

test("public login is readable and theme persists", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Remember the patterns/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
  const initial = await page.locator("html").getAttribute("data-theme");
  await page.getByRole("button", { name: /Switch to .* mode/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", initial ?? "dark");
  const changed = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", changed ?? "light");
});

test("protected routes redirect and responses carry baseline security headers", async ({ page, request }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
  const response = await request.get("/login");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  if (process.env.CI) {
    expect(response.headers()["content-security-policy"]).toContain("object-src 'none'");
    expect(response.headers()["strict-transport-security"]).toContain("max-age=");
  }
  const signout = await request.get("/auth/signout", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(signout.status());
});
