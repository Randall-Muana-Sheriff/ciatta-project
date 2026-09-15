// Pure helpers for draining a Storage prefix before deleting the account.
// No Deno or Supabase imports here on purpose: this file is plain TypeScript
// so a Node test can exercise it against a fake `list` function, while the
// edge function itself (Deno) imports it directly with a relative path.

export type Entry = { name: string; id: string | null };

// One page of a Storage listing: the entries under `prefix`, `limit` at a
// time, starting at `offset`. Supabase Storage represents a nested prefix as
// an entry whose `id` is null (it has no object of its own); a real object
// always carries an id.
export type ListPage = (prefix: string, limit: number, offset: number) => Promise<Entry[]>;

const PAGE_SIZE = 100;

/**
 * Walks every object under `rootPrefix`, descending into folder entries
 * (id === null) instead of trying to remove them, and paging each directory
 * until a page comes back shorter than the page size. Returns full object
 * paths ("<prefix>/<name>"), ready to pass to Storage's remove().
 *
 * `maxPasses` bounds the total number of list calls across the whole walk,
 * so a listing that never shrinks (or a pathological cycle) throws instead
 * of spinning forever, which would otherwise leave an account undeleted.
 */
export async function collectPaths(list: ListPage, rootPrefix: string, maxPasses = 10000): Promise<string[]> {
  const paths: string[] = [];
  const stack: string[] = [rootPrefix];
  let passes = 0;

  while (stack.length) {
    const dir = stack.pop()!;
    let offset = 0;
    for (;;) {
      passes += 1;
      if (passes > maxPasses) throw new Error('Storage listing did not finish');
      const entries = await list(dir, PAGE_SIZE, offset);
      if (!entries.length) break;
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`;
        if (entry.id === null) stack.push(full);
        else paths.push(full);
      }
      if (entries.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return paths;
}

// Splits a list into groups of at most `size`, in order. Storage's remove()
// takes a batch of paths at a time, so a large drain still removes in a
// bounded number of calls.
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
