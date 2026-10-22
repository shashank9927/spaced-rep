import { test, expect } from "./test";
import { createClient } from "@supabase/supabase-js";

test("onboarding saves a chosen name, timezone, and browsing catalog", async ({ page }) => {
  test.skip(!process.env.E2E_SUPABASE_URL);
  const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!);
  const reset = await admin.from("profiles").update({ display_name: null, onboarding_completed_at: null }).eq("email", "onboarding@recallcode.test");
  if (reset.error) throw reset.error;
  await page.goto("/today");
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("What should we call you?").fill("New Learner");
  await page.getByLabel("Your timezone").selectOption("Asia/Kolkata");
  await page.getByRole("button", { name: /NeetCode 250/ }).click();
  await page.getByRole("button", { name: "Start practicing" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("New Learner");
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue("Asia/Kolkata");
});
