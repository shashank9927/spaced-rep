import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ logs: [] as any[], cards: [] as any[], catalog: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ getProfile: async () => ({ id: "member", timezone: "Europe/Berlin", is_active: true }) }));
vi.mock("@/lib/performance", () => ({ measure: (_: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/supabase/server", () => {
  function from(table: string) {
    let rows = [...(table === "review_logs" ? state.logs : table === "catalog_problems" ? state.catalog : state.cards)];
    let start = 0, count = 1000;
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
      gte: (key: string, value: string) => { rows = rows.filter((row) => row[key] >= value); return query; },
      lt: (key: string, value: string) => { rows = rows.filter((row) => row[key] < value); return query; },
      order: () => query,
      limit: (value: number) => { count = value; return query; },
      range: (first: number, last: number) => { start = first; count = last - first + 1; return query; },
      or: (filter: string) => {
        const match = /^reviewed_at.lt.([^,]+),and\(reviewed_at.eq.([^,]+),id.lt.([^\)]+)\)$/.exec(filter);
        if (!match) throw new Error(`Unexpected cursor filter: ${filter}`);
        rows = rows.filter((row) => row.reviewed_at < match[1] || (row.reviewed_at === match[2] && row.id < match[3]));
        return query;
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows.slice(start, start + count), error: null }).then(resolve),
    };
    return query;
  }
  return { createClient: async () => ({ from }), createAdminClient: () => ({ from }) };
});

import { getProblemHistoryPage, getScheduleAgendaData, getTodayData, getCatalogProblems } from "@/lib/queries";
import { decodeHistoryCursor, encodeHistoryCursor, readAllPages } from "@/lib/pagination";
const problemId = "00000000-0000-4000-8000-000000000001";
function logs(count: number, reversedCount = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `10000000-0000-4000-8000-${String(count - i).padStart(12, "0")}`,
    problem_id: problemId, reviewed_at: new Date().toISOString().slice(0, 10) + "T12:00:00.000Z",
    rating: "good", event_kind: "first_attempt", note: null,
    review_reversals: i < reversedCount ? [{ reversed_at: new Date().toISOString() }] : [],
    problems: { title: "Two Sum", difficulty: "Easy", source_id: "1-two-sum", leetcode_number: 1 },
  }));
}

beforeEach(() => { state.logs = []; state.cards = []; state.catalog = []; });
describe("query pagination against Supabase row limits", () => {
  it("counts only the selected catalog while keeping other cards active", async () => {
    const problem = { id: problemId, source_id: "1-two-sum", leetcode_number: 1, title: "Two Sum", difficulty: "Easy", problem_topics: [] };
    state.catalog = [{ catalog_slug: "neetcode150", sort_order: 0, problems: problem }];
    state.cards = [{ problem_id: problemId, due_at: "2000-01-01T00:00:00Z", reps: 1, lapses: 0, scheduled_days: 3 }, { problem_id: "outside-selected-catalog", due_at: "2000-01-01T00:00:00Z", reps: 1, lapses: 0, scheduled_days: 3 }];
    const result = await getCatalogProblems("neetcode150");
    expect(result).toMatchObject({ activeCount: 1, dueCount: 1 });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).not.toHaveProperty("stability");
    expect(result.problems[0]).not.toHaveProperty("leetcode_url");
  });
  it("does not cap the user's due queue at 1000 cards", async () => {
    state.cards = Array.from({ length: 1201 }, (_, index) => ({ problem_id: String(index), due_at: "2026-01-01T12:00:00.000Z", last_review_at: "2025-12-29T12:00:00.000Z", first_attempted_at: "2025-12-29T12:00:00.000Z", stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 3, learning_steps: 0, reps: 1, lapses: 0, state: 2, version: 1, last_rating: "good", problems: { id: String(index), source_id: `${index + 1}-sample`, leetcode_number: index + 1, title: "Sample", difficulty: "Easy", problem_topics: [] } }));
    const result = await getTodayData();
    expect(result?.activeProblemCount).toBe(1201);
    expect(result?.dueReviews).toHaveLength(1201);
    expect(result?.upcomingReviews).toHaveLength(0);
  });
  it("validates opaque cursors before constructing a database filter", () => {
    expect(decodeHistoryCursor(encodeHistoryCursor({ reviewed_at: "2026-10-01T12:00:00.123456+00:00", id: problemId }))).toEqual({ reviewedAt: "2026-10-01T12:00:00.123456+00:00", id: problemId });
    expect(() => decodeHistoryCursor("v1." + Buffer.from(JSON.stringify({ reviewedAt: "bad),id.gt.0", id: problemId })).toString("base64url"))).toThrow();
    expect(() => decodeHistoryCursor("not-a-cursor")).toThrow();
  });
  it("propagates later page failures rather than returning partial metrics", async () => {
    await expect(readAllPages(async (offset) => offset === 0 ? { data: Array(500).fill(1), error: null } : { data: null, error: new Error("offline") })).rejects.toThrow("offline");
  });
  it("does not lose history entries sharing the boundary timestamp", async () => {
    state.logs = logs(45);
    const first = await getProblemHistoryPage(problemId);
    const second = await getProblemHistoryPage(problemId, first.nextCursor!);
    const third = await getProblemHistoryPage(problemId, second.nextCursor!);
    expect([first.entries.length, second.entries.length, third.entries.length]).toEqual([20, 20, 5]);
    expect(new Set([...first.entries, ...second.entries, ...third.entries].map((entry) => entry.id)).size).toBe(45);
    expect(third.nextCursor).toBeNull();
  });
  it("finds active history after more than 100 reversed events", async () => {
    state.logs = logs(160, 130);
    const first = await getProblemHistoryPage(problemId);
    expect(first.entries).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
  });
  it("returns every schedule event beyond the default 1000-row response cap", async () => {
    state.logs = logs(1405);
    const result = await getScheduleAgendaData();
    expect(result?.days).toHaveLength(14);
    expect(result?.days.reduce((sum, day) => sum + day.items.length, 0)).toBe(1405);
  });
});
