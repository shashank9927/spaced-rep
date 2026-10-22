import { describe, expect, it } from "vitest";
import { isolatedTestEnvironment } from "./e2e/environment";

describe("destructive test environment isolation", () => {
  const valid = { E2E_SUPABASE_URL: "http://127.0.0.1:54321", E2E_SUPABASE_ANON_KEY: "local", E2E_SUPABASE_SERVICE_ROLE_KEY: "local", PLAYWRIGHT_BASE_URL: "http://localhost:3000" };
  it("requires explicit test credentials and fails closed in CI", () => {
    expect(() => isolatedTestEnvironment({ CI: "true" })).toThrow();
    expect(() => isolatedTestEnvironment({ ...valid, E2E_SUPABASE_ANON_KEY: undefined, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "production" })).toThrow();
    expect(isolatedTestEnvironment(valid)?.url).toBe(valid.E2E_SUPABASE_URL);
    expect(isolatedTestEnvironment({})).toBeNull();
  });
  it("refuses hosted databases, deceptive hosts, and production app origins", () => {
    for (const url of ["https://project.supabase.co", "http://localhost.attacker.test", "http://127.0.0.1.attacker.test", "http://user:password@localhost"]) {
      expect(() => isolatedTestEnvironment({ ...valid, E2E_SUPABASE_URL: url })).toThrow();
    }
    expect(() => isolatedTestEnvironment({ ...valid, PLAYWRIGHT_BASE_URL: "https://recallcode.example" })).toThrow();
  });
});
