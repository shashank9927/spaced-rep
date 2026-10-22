import { z } from "zod";

const cursorSchema = z.object({ reviewedAt: z.string().datetime({ offset: true }), id: z.string().uuid() });
export type HistoryCursor = z.infer<typeof cursorSchema>;

export function encodeHistoryCursor(row: { reviewed_at: string; id: string }) {
  const value = cursorSchema.parse({ reviewedAt: row.reviewed_at, id: row.id });
  return `v1.${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
}

export function decodeHistoryCursor(value?: string): Partial<HistoryCursor> | null {
  if (!value) return null;
  // Accept timestamp cursors from a page left open during deployment.
  if (z.string().datetime({ offset: true }).safeParse(value).success) return { reviewedAt: value };
  if (value.length > 512 || !/^v1\.[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid history cursor.");
  return cursorSchema.parse(JSON.parse(Buffer.from(value.slice(3), "base64url").toString("utf8")));
}

export async function readAllPages<T>(fetchPage: (offset: number, size: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await fetchPage(offset, size);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < size) return rows;
  }
}
