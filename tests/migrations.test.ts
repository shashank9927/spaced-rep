import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("migration ordering", () => {
  it("assigns a unique version to every SQL migration", () => {
    const files = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql"));
    const seen = new Map<string, string>();
    for (const file of files) {
      const version = /^(\d+)_/.exec(file)?.[1];
      expect(version, `Missing version: ${file}`).toBeDefined();
      expect(seen.has(version!), `${file} duplicates ${seen.get(version!)}`).toBe(false);
      seen.set(version!, file);
    }
  });
});
