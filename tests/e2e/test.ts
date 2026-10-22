import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /hydration|content security policy|\$RC.*not defined/i.test(message.text())) errors.push(message.text());
    });
    await use();
    expect(errors, "Browser runtime, hydration, and CSP failures").toEqual([]);
  }, { auto: true }],
});
export { expect };
