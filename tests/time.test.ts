import { describe, expect, it } from "vitest";
import { localDateKey } from "@/lib/utils";

describe("local date boundaries", () => {
  it("uses the profile timezone instead of server-local time", () => {
    const instant = new Date("2026-09-24T00:30:00.000Z");
    expect(localDateKey(instant, "America/Los_Angeles")).toBe("2026-09-23");
    expect(localDateKey(instant, "Europe/Berlin")).toBe("2026-09-24");
  });
});
