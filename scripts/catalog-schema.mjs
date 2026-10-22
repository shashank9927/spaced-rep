import { z } from "zod";

const catalogIds = ["neetcode150", "neetcode250", "allNC"];
const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"), "Only HTTPS URLs are allowed.");
const sourceId = z.string().regex(/^\d{1,6}-[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid numbered source ID.");

export const catalogProblemSchema = z.object({
  sourceId: sourceId,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  title: z.string().trim().min(1).max(200),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  topics: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  leetcodeUrl: httpsUrl.nullable(),
  neetcodeUrl: httpsUrl.nullable(),
  catalogs: z.array(z.enum(catalogIds)).min(1).max(3).refine((values) => new Set(values).size === values.length),
  catalogOrder: z.record(z.enum(catalogIds), z.number().int().nonnegative()).default({}),
});

export const catalogSnapshotSchema = z.object({
  source: z.literal("neetcode-public-catalog"),
  sourceUrl: httpsUrl,
  bundleUrl: httpsUrl,
  generatedAt: z.string().datetime(),
  version: z.string().regex(/^neetcode-\d{4}-\d{2}-\d{2}-[a-f0-9]{10}$/),
  problems: z.array(catalogProblemSchema).min(1),
});

export function validateCatalogSnapshot(value) {
  const snapshot = catalogSnapshotSchema.parse(value);
  for (const source of [snapshot.sourceUrl, snapshot.bundleUrl]) {
    const hostname = new URL(source).hostname;
    if (hostname !== "neetcode.io" && !hostname.endsWith(".neetcode.io")) throw new Error("Catalog source URLs must use the NeetCode host.");
  }
  const ids = new Set();
  const numbers = new Set();
  const orders = new Map(catalogIds.map((catalog) => [catalog, new Set()]));
  for (const problem of snapshot.problems) {
    if (ids.has(problem.sourceId)) throw new Error(`Duplicate catalog source ID: ${problem.sourceId}`);
    ids.add(problem.sourceId);
    const match = /^(\d+)-/.exec(problem.sourceId);
    const number = problem.sourceId === "2633-neighboring-bitwise-xor" ? 2683 : Number.parseInt(match[1], 10);
    if (!Number.isSafeInteger(number) || number < 1 || numbers.has(number)) throw new Error(`Invalid or duplicate LeetCode number for ${problem.sourceId}`);
    numbers.add(number);
    for (const catalog of problem.catalogs) {
      if (!Number.isInteger(problem.catalogOrder[catalog]) || problem.catalogOrder[catalog] < 0) throw new Error(`Missing ${catalog} order for ${problem.sourceId}`);
      if (orders.get(catalog).has(problem.catalogOrder[catalog])) throw new Error(`Duplicate ${catalog} order for ${problem.sourceId}`);
      orders.get(catalog).add(problem.catalogOrder[catalog]);
    }
    if (problem.leetcodeUrl) {
      const hostname = new URL(problem.leetcodeUrl).hostname;
      if (hostname !== "leetcode.com" && !hostname.endsWith(".leetcode.com")) throw new Error(`Invalid LeetCode URL for ${problem.sourceId}`);
    }
    if (problem.neetcodeUrl) {
      const hostname = new URL(problem.neetcodeUrl).hostname;
      if (hostname !== "neetcode.io" && !hostname.endsWith(".neetcode.io")) throw new Error(`Invalid NeetCode URL for ${problem.sourceId}`);
    }
  }
  const count150 = snapshot.problems.filter((problem) => problem.catalogs.includes("neetcode150")).length;
  const count250 = snapshot.problems.filter((problem) => problem.catalogs.includes("neetcode250")).length;
  if (count150 !== 150 || count250 !== 250) throw new Error(`Catalog validation failed (150=${count150}, 250=${count250}).`);
  return snapshot;
}
