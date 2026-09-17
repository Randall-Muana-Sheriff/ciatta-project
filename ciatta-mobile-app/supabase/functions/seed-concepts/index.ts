// Seeds the concepts table from UMLS. Run once, and again when the
// vocabulary in conceptMap.ts changes.
//
// Server only, and it enforces that the same way the baselines function
// does: the bearer must be the service role key, compared in constant time,
// and anything else is refused with a 401 before a single request goes out.
// The reason is narrower here but still real: this function holds the UMLS
// key, and an open endpoint that spends someone else's rate limit is not
// something to leave standing.
//
// Nothing about her ever reaches UMLS. The only strings sent are vocabulary
// terms such as "Heart rate" and "Fatigue": no values, no dates, no user id,
// no row from her record.
//
// The key discipline in this file is narrow and absolute. This is where the
// UMLS key is read and where the real fetch is supplied, so this is the file
// that can leak it. On Deno a failed request rejects with the full request
// URL in the error and again in its cause, and that URL carries the key as a
// query parameter. So no error object, no error message, no cause and no
// constructed URL is ever logged here or returned to a caller. An error name
// is the most that leaves, and that is all seed.ts logs.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { runSeed, type ConceptRow } from './seed.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// The same constant time comparison the baselines function uses, and for the
// same reason: a plain === stops at the first differing byte, so how long it
// takes says how much of a guess was right.
function bearerIsServiceRole(given: string): boolean {
  const encoder = new TextEncoder();
  const presented = encoder.encode(given);
  const expected = encoder.encode(serviceKey);
  if (expected.length === 0) return false;
  let difference = presented.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) difference |= (presented[i] ?? 0) ^ expected[i];
  return difference === 0;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Not supported' }, 405);

  const authorization = req.headers.get('Authorization') ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  if (!bearerIsServiceRole(bearer)) return json({ error: 'Not allowed' }, 401);

  const apiKey = Deno.env.get('UMLS_API_KEY') ?? '';
  if (!apiKey) {
    // Reported rather than raised, and named precisely, because this is the
    // ordinary deploy day failure and a person needs to know which secret.
    return json({ error: 'UMLS_API_KEY is not set on this function' }, 503);
  }

  // The request names terms and nothing else. Omitting them seeds the whole
  // vocabulary; naming them seeds that subset. Either way the term has to be
  // in the compiled in list, and the system, domain and expected code come
  // from that list rather than from the request.
  let requested: readonly unknown[] | null;
  try {
    const body = await req.json().catch(() => ({}));
    const terms = (body ?? {}).terms;
    if (terms === undefined) {
      requested = null;
    } else if (Array.isArray(terms)) {
      requested = terms;
    } else {
      return json({ error: 'Invalid batch' }, 400);
    }
  } catch {
    return json({ error: 'Invalid batch' }, 400);
  }

  const admin: any = createClient(url, serviceKey);

  const write = async (row: ConceptRow) => {
    const { error } = await admin.from('concepts').upsert(row, { onConflict: 'system,code' });
    if (error) throw error;
  };

  const report = await runSeed({ fetcher: fetch, apiKey, sleep, write }, requested);

  // A term from outside the vocabulary is refused and the whole batch writes
  // nothing. This is the guard that keeps public.concepts reference data:
  // the table has no RLS and no owner, which is only safe while no row in it
  // can be created because a particular woman logged a particular thing.
  if (report.refused.length > 0) {
    return json({ error: 'Not in the vocabulary', refused: report.refused }, 400);
  }

  return json({
    considered: report.considered,
    written: report.written,
    // Five lists rather than counts, because each one asks a different person
    // for a different thing, and pooling any two of them would state
    // something untrue.
    //
    // Together with written they also account for every term considered:
    // written plus the five lengths equals considered, for any run. That
    // identity is the thing worth holding, and it is asserted in the test
    // suite. A term that satisfies none of these categories is a term written
    // nowhere and reported nowhere, which is exactly the defect the unusable
    // list was added to close.
    //
    // mismatched: a written code disagrees with the vocabulary. Someone needs
    //   to look at both codes and decide which is right.
    // missing: UMLS answered and had nothing. Someone needs to decide whether
    //   that part of her vocabulary can be standardised at all. This is not
    //   proof that no code exists, and nothing downstream may read it so.
    // unreached: the request did not complete. Retry. This says nothing about
    //   the vocabulary, which is exactly why it is not in missing.
    // unwritten: UMLS answered but the row did not reach the database. Look
    //   at the database, not at the vocabulary. A unit appears here without
    //   UMLS ever having been asked.
    // unusable: UMLS answered with a code and no display text, so there was
    //   nothing writable to send. Look at the UMLS record for the code, or
    //   give the term a display in the vocabulary. The database is not at
    //   fault and was never asked, which is why this is not unwritten.
    mismatched: report.mismatched,
    missing: report.missing,
    unreached: report.unreached,
    unwritten: report.unwritten,
    unusable: report.unusable,
  });
});
