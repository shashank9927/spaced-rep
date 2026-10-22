import { describe, expect, it } from "vitest";
import { timezoneOptions } from "@/lib/timezones";

describe("timezone choices across ICU versions", () => {
  it("offers modern Kolkata when the runtime enumerates only Calcutta", () => {
    expect(timezoneOptions("Europe/Berlin", ["Asia/Calcutta", "Europe/Berlin"])).toContain("Asia/Kolkata");
  });
  it("retains stored aliases, includes UTC, and removes invalid or duplicate options", () => {
    const zones = timezoneOptions("Asia/Calcutta", ["Asia/Calcutta", "Asia/Kolkata", "invalid/timezone"]);
    expect(zones).toContain("Asia/Calcutta");
    expect(zones).toContain("UTC");
    expect(zones.filter((zone) => zone === "Asia/Kolkata")).toHaveLength(1);
    expect(zones).not.toContain("invalid/timezone");
  });
});
