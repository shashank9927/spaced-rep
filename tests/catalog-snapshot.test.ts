import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { leetcodeNumberFromSourceId } from "@/lib/utils";

const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "data/catalog.snapshot.json"), "utf8"));

describe("catalog snapshot", () => {
  it("contains stable unique problem metadata", () => {
    const ids = snapshot.problems.map((problem: { sourceId: string }) => problem.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(snapshot.problems.every((problem: { title: string; difficulty: string }) => problem.title && ["Easy", "Medium", "Hard"].includes(problem.difficulty))).toBe(true);
    expect(snapshot.problems.every((problem: { sourceId: string }) => /^\d+-/.test(problem.sourceId) && Number.parseInt(problem.sourceId, 10) > 0)).toBe(true);
    expect(new Set(ids.map((sourceId: string) => leetcodeNumberFromSourceId(sourceId))).size).toBe(ids.length);
  });

  it("preserves the official 150 and 250 memberships", () => {
    expect(snapshot.problems.filter((problem: { catalogs: string[] }) => problem.catalogs.includes("neetcode150"))).toHaveLength(150);
    expect(snapshot.problems.filter((problem: { catalogs: string[] }) => problem.catalogs.includes("neetcode250"))).toHaveLength(250);
    expect(snapshot.problems.every((problem: { catalogs: string[] }) => problem.catalogs.includes("allNC"))).toBe(true);
  });

  it("derives the real LeetCode number from the stable source ID", () => {
    expect(leetcodeNumberFromSourceId("0001-two-sum")).toBe(1);
    expect(leetcodeNumberFromSourceId("0200-number-of-islands")).toBe(200);
    expect(() => leetcodeNumberFromSourceId("two-sum")).toThrow("Invalid LeetCode source ID");
  });
});
