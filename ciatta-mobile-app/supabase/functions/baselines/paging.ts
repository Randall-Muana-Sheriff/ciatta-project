// Reading all of something out of the Data API, where "all" is the point.
//
// The rule this file exists to enforce: every read in runJob over her
// observations must be complete by construction, never by a server default.
// PostgREST caps one response at max_rows (1000, in supabase/config.toml),
// so a select that does not page comes back silently short once she has
// logged more than that in the window. There is no error and no flag. The
// run simply computes over part of her record and reports success, and the
// woman who has logged the most is the one who gets the least complete
// answer. That is incomplete input presented as a finished job, which is
// worse than a visible failure because nothing ever surfaces it.
//
// Keyset, not offset. range(from, to) makes Postgres walk and discard every
// row before `from` on each page, so the total work grows with the square
// of the page count. It is worse than it looks here: observations is
// indexed on (user_id, domain, metric, occurred_at desc), and the links
// read filters on neither domain nor metric, so that index cannot serve
// this ordering and every page pays a fresh sort of the whole window.
// Carrying the last row's (occurred_at, id) forward and asking for rows
// strictly after it keeps each page's work proportional to the page, and
// lands the cost on the same heavy user the memory bound protects.
//
// No Deno or Supabase imports, the same arrangement as compute.ts and
// links.ts: the loop and its boundary arithmetic are exercised directly
// under node:test, in src/data/paging.test.ts.

// The last row of the page before, as the two columns that order the read.
export type Cursor = { occurredAt: string; id: string };

// Every row this pages over carries the two columns the cursor is built
// from. occurred_at is the raw string as the Data API returned it, never a
// reformatted one: a Date round trip truncates microseconds to
// milliseconds, and a cursor a shade earlier than the row it came from
// would hand that row back a second time on the next page.
export type KeyedRow = { id: string; occurred_at: string };

export type PageResult<T> = { data: T[] | null; error: unknown };

export type FetchPage<T> = (after: Cursor | null, limit: number) => PromiseLike<PageResult<T>>;

// Exactly max_rows. Asking for more would be truncated to max_rows by the
// server, and a full page would then look short against what was asked for,
// ending the loop early and reintroducing the silent truncation this whole
// file exists to remove.
export const OBSERVATION_PAGE_SIZE = 1000;

// The filter that makes a page begin strictly after the last row of the one
// before, as a PostgREST `or` group.
//
// The boundary is the whole point. Several observations routinely share an
// occurred_at, because a device posts a night's readings under one
// timestamp. `occurred_at > cursor` would skip every row that shares the
// cursor's instant but sorts after it by id, and `occurred_at >= cursor`
// would hand back every row of that instant again, including the cursor
// row itself. Duplicates are not harmless here: two copies of one
// observation pair with everything else twice, and the upsert then carries
// the same conflict key twice in one statement, which Postgres rejects
// outright. So the condition is the tuple comparison written out,
// (occurred_at, id) > (cursor.occurredAt, cursor.id), which is exactly the
// order the read is sorted by and therefore admits each row exactly once.
//
// The timestamp is double quoted because the Data API renders it with a
// +00:00 offset, and an unquoted + in a filter value is ambiguous.
export function keysetFilter(after: Cursor): string {
  return `occurred_at.gt."${after.occurredAt}",and(occurred_at.eq."${after.occurredAt}",id.gt.${after.id})`;
}

// Pages until a page comes back short of what was asked for, which is the
// only signal the Data API gives that there is nothing after it.
export async function readAllPages<T extends KeyedRow>(
  fetchPage: FetchPage<T>,
  pageSize: number = OBSERVATION_PAGE_SIZE
): Promise<T[]> {
  const out: T[] = [];
  let after: Cursor | null = null;

  for (;;) {
    const { data, error } = await fetchPage(after, pageSize);
    // A page that fails ends the run. Returning what already arrived would
    // produce exactly the partial set this file exists to prevent, and the
    // caller could not tell it apart from a genuinely complete read.
    if (error) throw error;

    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) return out;

    const last = rows[rows.length - 1];
    after = { occurredAt: last.occurred_at, id: last.id };
  }
}
