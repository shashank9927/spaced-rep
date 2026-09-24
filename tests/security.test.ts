import { describe, expect, it } from "vitest";
import { isAllowedExternalUrl, timezoneSchema } from "@/lib/security";

describe("security validation", () => {
  it("accepts real IANA timezones and rejects malformed values", () => {
    expect(timezoneSchema.safeParse("America/New_York").success).toBe(true);
    expect(timezoneSchema.safeParse("not/a-timezone").success).toBe(false);
  });

  it("allows only approved HTTPS external hosts", () => {
    expect(isAllowedExternalUrl("https://leetcode.com/problems/two-sum/")).toBe(true);
    expect(isAllowedExternalUrl("https://neetcode.io/problems/two-sum/question")).toBe(true);
    expect(isAllowedExternalUrl("http://leetcode.com/problems/two-sum/")).toBe(false);
    expect(isAllowedExternalUrl("https://leetcode.com.evil.example/redirect")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
  });
});
