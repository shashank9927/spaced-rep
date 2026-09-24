import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { validateCatalogSnapshot } from "./catalog-schema.mjs";

dotenv.config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local.");

const snapshot = validateCatalogSnapshot(JSON.parse(await readFile("data/catalog.snapshot.json", "utf8")));
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const chunks = (items, size = 500) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
async function assert(step, request) {
  const result = await request;
  if (result.error) {
    const { message, details, hint, code } = result.error;
    throw new Error(`${step} failed (HTTP ${result.status ?? "unknown"} ${result.statusText ?? ""}). ${message}${code ? ` [${code}]` : ""}${details ? ` Details: ${details}` : ""}${hint ? ` Hint: ${hint}` : ""}`);
  }
  return result.data;
}

const sourceIds = snapshot.problems.map((problem) => problem.sourceId);
if (new Set(sourceIds).size !== sourceIds.length) throw new Error("Catalog snapshot contains duplicate source IDs.");
const leetcodeNumbers = sourceIds.map((sourceId) => {
  const match = /^(\d+)-/.exec(sourceId);
  if (!match || Number.parseInt(match[1], 10) < 1) throw new Error(`Catalog snapshot has an invalid LeetCode source ID: ${sourceId}`);
  return sourceId === "2633-neighboring-bitwise-xor" ? 2683 : Number.parseInt(match[1], 10);
});
if (new Set(leetcodeNumbers).size !== leetcodeNumbers.length) throw new Error("Catalog snapshot contains duplicate LeetCode problem numbers.");
const memberships = (slug) => snapshot.problems.filter((problem) => problem.catalogs.includes(slug));
if (memberships("neetcode150").length !== 150) throw new Error("Catalog snapshot must contain exactly 150 NeetCode 150 memberships.");
if (memberships("neetcode250").length !== 250) throw new Error("Catalog snapshot must contain exactly 250 NeetCode 250 memberships.");
for (const problem of snapshot.problems) {
  for (const value of [problem.leetcodeUrl, problem.neetcodeUrl].filter(Boolean)) {
    const parsed = new URL(value);
    const allowed = parsed.hostname === "leetcode.com" || parsed.hostname.endsWith(".leetcode.com") || parsed.hostname === "neetcode.io" || parsed.hostname.endsWith(".neetcode.io");
    if (parsed.protocol !== "https:" || !allowed) throw new Error(`Catalog contains an unapproved external URL for ${problem.sourceId}.`);
  }
}

console.log(`Connecting to ${new URL(url).host}…`);
await assert("Saving the catalog snapshot", supabase.from("catalog_snapshots").upsert({ version: snapshot.version, source: snapshot.source, source_url: snapshot.sourceUrl, problem_count: snapshot.problems.length }, { onConflict: "version" }));
const payload = snapshot.problems.map((problem, index) => ({ source_id: problem.sourceId, leetcode_number: leetcodeNumbers[index], slug: problem.slug, title: problem.title, difficulty: problem.difficulty, leetcode_url: problem.leetcodeUrl, neetcode_url: problem.neetcodeUrl, metadata_version: snapshot.version, is_active: true }));
for (const [index, chunk] of chunks(payload).entries()) await assert(`Importing problem batch ${index + 1}`, supabase.from("problems").upsert(chunk, { onConflict: "source_id" }));
const problemRows = [];
for (let from = 0; ; from += 500) {
  const rows = await assert(`Reading imported problem IDs starting at ${from + 1}`, supabase.from("problems").select("id,source_id").eq("metadata_version", snapshot.version).order("source_id").range(from, from + 499));
  problemRows.push(...rows);
  if (rows.length < 500) break;
}
const rows = problemRows;
const problemId = new Map(rows.map((row) => [row.source_id, row.id]));
if (problemId.size !== payload.length || payload.some((problem) => !problemId.has(problem.source_id))) {
  throw new Error(`Imported problem ID validation failed. Expected ${payload.length}, found ${problemId.size}.`);
}

const topicNames = [...new Set(snapshot.problems.flatMap((problem) => problem.topics))];
if (topicNames.length) {
  await assert("Importing topics", supabase.from("topics").upsert(topicNames.map((name) => ({ name })), { onConflict: "name" }));
  const topicRows = await assert("Reading imported topics", supabase.from("topics").select("id,name").in("name", topicNames));
  const topicId = new Map(topicRows.map((row) => [row.name, row.id]));
  const links = snapshot.problems.flatMap((problem) => problem.topics.map((topic, position) => ({ problem_id: problemId.get(problem.sourceId), topic_id: topicId.get(topic), position, is_primary: position === 0 }))).filter((link) => link.problem_id && link.topic_id);
  for (const [index, chunk] of chunks(links).entries()) await assert(`Linking problem topics batch ${index + 1}`, supabase.from("problem_topics").upsert(chunk, { onConflict: "problem_id,topic_id" }));
}

const catalogs = [["neetcode150", "NeetCode 150", "The core interview-practice list."], ["neetcode250", "NeetCode 250", "A longer, beginner-friendly progression."], ["allNC", "NeetCode All", "Every problem from the imported public catalog snapshot."]];
for (const [slug, name, description] of catalogs) {
  await assert(`Saving ${slug}`, supabase.from("catalogs").upsert({ slug, name, description, snapshot_version: snapshot.version, updated_at: new Date().toISOString() }, { onConflict: "slug" }));
  await assert(`Clearing old ${slug} membership`, supabase.from("catalog_problems").delete().eq("catalog_slug", slug));
  const selected = memberships(slug);
  const hasExplicitOrder = selected.every((problem) => Number.isInteger(problem.catalogOrder?.[slug]));
  const ordered = [...selected].sort((a, b) => hasExplicitOrder
    ? a.catalogOrder[slug] - b.catalogOrder[slug]
    : a.sourceId.localeCompare(b.sourceId));
  if (hasExplicitOrder && new Set(ordered.map((problem) => problem.catalogOrder[slug])).size !== ordered.length) {
    throw new Error(`Catalog snapshot contains duplicate ${slug} order values.`);
  }
  const catalogMemberships = ordered.map((problem, sort_order) => ({ catalog_slug: slug, problem_id: problemId.get(problem.sourceId), sort_order })).filter((row) => row.problem_id);
  for (const [index, chunk] of chunks(catalogMemberships).entries()) await assert(`Importing ${slug} membership batch ${index + 1}`, supabase.from("catalog_problems").insert(chunk));
}
console.log(`Imported ${snapshot.problems.length} problems from ${snapshot.version}.`);
