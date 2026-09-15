// A pure helper, with no react native or supabase imports, so it stays
// testable under plain node:test as well as usable from account.ts.

// Reads one page of rows, `from` through `to` inclusive.
export type PageFetcher<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;

const PAGE_SIZE = 1000;

// PostgREST caps a single response (max_rows in supabase/config.toml), so a
// plain select('*') can come back silently short on a large table. Keeps
// asking for the next PAGE_SIZE rows, ordered by a stable column chosen by
// the caller, until a page comes back short of a full page.
export async function paginateAll<T>(fetchPage: PageFetcher<T>): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}
