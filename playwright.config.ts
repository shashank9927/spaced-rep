import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  // Files may run concurrently, but journeys sharing a member fixture cannot.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "msedge",
  },
  projects: [
    { name: "public", testMatch: "public.spec.ts" },
    { name: "member", testMatch: "member-workflow.spec.ts", use: { storageState: ".playwright/auth/member.json" } },
    { name: "admin", testMatch: "admin.spec.ts", use: { storageState: ".playwright/auth/admin.json" } },
    { name: "disabled", testMatch: "access-and-responsive.spec.ts", grep: /disabled membership/, use: { storageState: ".playwright/auth/disabled.json" } },
    { name: "onboarding", testMatch: "onboarding.spec.ts", use: { storageState: ".playwright/auth/onboarding.json" } },
    {
      name: "mobile",
      testMatch: "access-and-responsive.spec.ts",
      grep: /mobile navigation/,
      use: {
        ...devices["iPhone 13"],
        // Keep mobile emulation on the same locally installed Chromium
        // browser. The stock iPhone descriptor selects WebKit, which would
        // require downloading another browser on developer machines.
        browserName: "chromium",
        channel: process.env.CI ? undefined : "msedge",
        storageState: ".playwright/auth/mobile.json",
      },
    },
  ],
  webServer: {
    command: process.env.CI || process.env.E2E_PRODUCTION === "true" ? "npm run build && npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
