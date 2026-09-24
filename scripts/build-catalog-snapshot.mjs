import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseExpressionAt } from "acorn";
import { validateCatalogSnapshot } from "./catalog-schema.mjs";

const pageUrl = "https://neetcode.io/practice/practice/neetcode150";
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

function assertNeetCodeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || (url.hostname !== "neetcode.io" && !url.hostname.endsWith(".neetcode.io"))) throw new Error("Catalog fetch redirected to an unapproved host.");
  return url;
}

async function fetchText(value, label) {
  const url = assertNeetCodeUrl(value);
  let response;
  try {
    response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: "text/html,application/javascript,text/javascript" } });
  } catch (error) {
    throw new Error(`Could not load ${label}: ${error instanceof Error ? error.message : "network error"}`);
  }
  if (!response.ok) throw new Error(`Could not load ${label}: HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_RESPONSE_BYTES) throw new Error(`${label} is larger than the allowed import size.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/(text\/html|javascript|text\/plain)/i.test(contentType)) throw new Error(`${label} returned an unexpected content type.`);
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error(`${label} is larger than the allowed import size.`);
  return text;
}

function evaluateStatic(node) {
  if (node.type === "Literal") {
    if (node.regex || typeof node.value === "bigint" || (typeof node.value !== "string" && typeof node.value !== "number" && typeof node.value !== "boolean" && node.value !== null)) throw new Error("Unsupported literal.");
    return node.value;
  }
  if (node.type === "ArrayExpression") return node.elements.map((element) => element ? evaluateStatic(element) : null);
  if (node.type === "ObjectExpression") {
    const result = {};
    for (const property of node.properties) {
      if (property.type !== "Property" || property.kind !== "init" || property.method || property.computed || property.shorthand || property.value.type === "SpreadElement") throw new Error("Executable object property rejected.");
      const key = property.key.type === "Identifier" ? property.key.name : evaluateStatic(property.key);
      if (typeof key !== "string" && typeof key !== "number") throw new Error("Invalid object key.");
      result[String(key)] = evaluateStatic(property.value);
    }
    return result;
  }
  if (node.type === "UnaryExpression" && (node.operator === "+" || node.operator === "-" || node.operator === "!")) {
    const value = evaluateStatic(node.argument);
    if (node.operator === "!" && (typeof value !== "boolean" && typeof value !== "number")) throw new Error("Invalid boolean expression.");
    if (node.operator !== "!" && typeof value !== "number") throw new Error("Invalid numeric expression.");
    if (node.operator === "!") return !value;
    return node.operator === "-" ? -value : value;
  }
  throw new Error(`Executable catalog expression rejected: ${node.type}`);
}

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
  const entries = [];
  let cursor = 0;
  while (cursor < bundle.length) {
    const start = bundle.indexOf('{problem:"', cursor);
    if (start < 0) break;
    const end = objectEnd(bundle, start);
    cursor = end;
    try {
      const expression = parseExpressionAt(bundle.slice(start, end), 0, { ecmaVersion: "latest" });
      const entry = evaluateStatic(expression);
      if (entry && typeof entry.problem === "string" && typeof entry.code === "string" && ["Easy", "Medium", "Hard"].includes(entry.difficulty)) entries.push(entry);
    } catch {
      // Unrelated literals are ignored; executable expressions never run.
    }
  }
  return entries;
}

function canonicalize(entries) {
  const byId = new Map();
  for (const [index, entry] of entries.entries()) {
    const slug = String(entry.ncLink || entry.link || entry.code || entry.problem).replace(/^\/+|\/+$/g, "").replace(/\/question$/, "");
    const sourceId = String(entry.code).replace(/^\/+|\/+$/g, "").toLowerCase();
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
  return [...byId.values()];
}

const page = await fetchText(pageUrl, "NeetCode catalog page");
const mainFile = page.match(/(?:src=")(\/??[^"']*main\.[^"']+\.js)/)?.[1] ?? page.match(/(?:src=")([^"/]*main\.[^"']+\.js)/)?.[1];
if (!mainFile) throw new Error("Could not locate the public NeetCode application bundle.");
const bundleUrl = new URL(mainFile, "https://neetcode.io/").toString();
const bundle = await fetchText(bundleUrl, "NeetCode catalog bundle");
const problems = canonicalize(parsePublicProblemObjects(bundle));
const generatedAt = new Date().toISOString();
const version = `neetcode-${generatedAt.slice(0, 10)}-${createHash("sha256").update(bundle).digest("hex").slice(0, 10)}`;
const snapshot = validateCatalogSnapshot({ source: "neetcode-public-catalog", sourceUrl: pageUrl, bundleUrl, generatedAt, version, problems });
const output = resolve("data/catalog.snapshot.json");
await mkdir(resolve("data"), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
const count150 = problems.filter((problem) => problem.catalogs.includes("neetcode150")).length;
const count250 = problems.filter((problem) => problem.catalogs.includes("neetcode250")).length;
console.log(`Wrote ${problems.length} problems (${count150} in 150, ${count250} in 250) to ${output}`);
