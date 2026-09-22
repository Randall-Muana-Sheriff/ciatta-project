// Reading all of something out of the Data API, where "all" is the point.
//
// The rule this file exists to enforce: every read in runJob over her
// observations must be complete by construction, never by a server default.
// PostgREST caps one response at max_rows, so a select that does not page
// comes back silently short once she has logged more than that in the
// window. There is no error and no flag. The
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

// A hint about the server's row ceiling, never a contract with it.
//
// It cannot be a contract, and that is a fact about where the setting
// lives rather than a shortcoming here. max_rows is a server setting: the
// 1000 in supabase/config.toml governs the LOCAL stack only, the hosted
// project's value lives in its dashboard, and a db push never carries one
// to the other. Nothing in this repository can read the live number, and no
// test run here can catch the two disagreeing.
//
// So this value only decides how many round trips a complete read costs. If
// the live ceiling is lower, pages come back smaller and the loop makes
// more of them; if it is higher, the extra is simply never asked for.
// Correctness rests on the loop's termination instead, which is why that
// ends on an empty page rather than a short one: a short page cannot be
// told apart from a server ceiling below what was requested.
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
//
// `column` names the ordering column. It defaults to occurred_at, which is
// what every read over her observations orders by; the intelligence
// function pages temporal_links by occurred_on and changes by detected_at
// with the same tuple rule, and passes the column so the filter and the
// order it relies on can never name different columns.
export function keysetFilter(after: Cursor, column = 'occurred_at'): string {
  return `${column}.gt."${after.occurredAt}",and(${column}.eq."${after.occurredAt}",id.gt.${after.id})`;
}

// Pages until a page comes back empty, which is the only signal the Data
// API gives that can be trusted to mean there is nothing after it.
//
// Ending on a SHORT page was the obvious reading and was wrong in exactly
// one place, production. A short page means either the end of the table or
// a server row ceiling below the size requested, and the two are
// indistinguishable from here. Since the live max_rows cannot be read from
// this repository (see OBSERVATION_PAGE_SIZE), a live ceiling under the
// requested size would have ended the loop after one page and truncated
// both observation reads silently, which is the fault this file exists to
// prevent, reachable only where nothing could test for it.
//
// Ending on empty costs one extra round trip per read and is correct for
// any ceiling: the cursor advances from the last row actually returned, so
// a page of any size at all still carries the loop forward correctly.
//
// `cursorOf` reads the ordering tuple off the last row of a page. The
// default is (occurred_at, id); a read ordered by another column passes
// its own, and the raw string rule above applies to it just the same.
export async function readAllPages<T extends { id: string }>(
  fetchPage: FetchPage<T>,
  pageSize: number = OBSERVATION_PAGE_SIZE,
  cursorOf: (row: T) => Cursor = (row) => ({ occurredAt: (row as unknown as KeyedRow).occurred_at, id: row.id })
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
    if (rows.length === 0) return out;

    after = cursorOf(rows[rows.length - 1]);
  }
}
