import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const pageUrl = "https://neetcode.io/practice/practice/neetcode150";

function objectEnd(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  throw new Error("Unterminated object in NeetCode bundle.");
}

function parsePublicProblemObjects(bundle) {
  const rawObjects = [];
  let cursor = 0;
  while (cursor < bundle.length) {
    const start = bundle.indexOf('{problem:"', cursor);
    if (start < 0) break;
    const end = objectEnd(bundle, start);
    const raw = bundle.slice(start, end);
    cursor = end;
    try {
      // One object literal from NeetCode's public app bundle; unrelated literals are ignored.
      const entry = Function(`"use strict"; return (${raw});`)();
      if (typeof entry.problem === "string" && ["Easy", "Medium", "Hard"].includes(entry.difficulty)) rawObjects.push(entry);
    } catch {
      // The source can contain unrelated minified objects that share the key name.
    }
  }
  return rawObjects;
}

function canonicalize(entries) {
  const byId = new Map();
  for (const [index, entry] of entries.entries()) {
    const slug = String(entry.ncLink || entry.link || entry.code || entry.problem)
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/question$/, "");
    const sourceId = String(entry.code || `nc-${slug}`).toLowerCase();
    const existing = byId.get(sourceId);
    const catalogs = new Set(existing?.catalogs ?? []);
    if (entry.neetcode150) catalogs.add("neetcode150");
    if (entry.neetcode250) catalogs.add("neetcode250");
    catalogs.add("allNC");
    const catalogOrder = { ...(existing?.catalogOrder ?? {}) };
    if (entry.neetcode150 && catalogOrder.neetcode150 === undefined) catalogOrder.neetcode150 = index;
    if (entry.neetcode250 && catalogOrder.neetcode250 === undefined) catalogOrder.neetcode250 = index;
    if (catalogOrder.allNC === undefined) catalogOrder.allNC = index;
    byId.set(sourceId, {
      sourceId,
      slug,
      title: entry.problem,
      difficulty: entry.difficulty,
      topics: entry.pattern ? [entry.pattern] : [],
      leetcodeUrl: entry.link ? `https://leetcode.com/problems/${String(entry.link).replace(/^\/+/, "")}` : null,
      neetcodeUrl: entry.ncLink ? `https://neetcode.io/problems/${String(entry.ncLink).replace(/^\/+/, "")}question` : null,
      catalogs: [...catalogs],
      catalogOrder,
    });
  }
  // The public bundle order is the official catalog order. Never sort by ID.
  return [...byId.values()];
}

const page = await fetch(pageUrl).then(async (response) => {
  if (!response.ok) throw new Error(`Could not load NeetCode catalog page: ${response.status}`);
  return response.text();
});
const mainFile = page.match(/(?:src=")([^"/]*main\.[^"]+\.js)/)?.[1];
if (!mainFile) throw new Error("Could not locate the public NeetCode application bundle.");
const bundleUrl = new URL(mainFile, "https://neetcode.io/").toString();
const bundle = await fetch(bundleUrl).then(async (response) => {
  if (!response.ok) throw new Error(`Could not load NeetCode bundle: ${response.status}`);
  return response.text();
});
const problems = canonicalize(parsePublicProblemObjects(bundle));
const count150 = problems.filter((problem) => problem.catalogs.includes("neetcode150")).length;
const count250 = problems.filter((problem) => problem.catalogs.includes("neetcode250")).length;
if (count150 !== 150 || count250 !== 250) throw new Error(`Catalog validation failed (150=${count150}, 250=${count250}). NeetCode may have changed its bundle shape.`);

const generatedAt = new Date().toISOString();
const version = `neetcode-${generatedAt.slice(0, 10)}-${createHash("sha256").update(bundle).digest("hex").slice(0, 10)}`;
const snapshot = { source: "neetcode-public-catalog", sourceUrl: pageUrl, bundleUrl, generatedAt, version, problems };
const output = resolve("data/catalog.snapshot.json");
await mkdir(resolve("data"), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${problems.length} problems (${count150} in 150, ${count250} in 250) to ${output}`);
