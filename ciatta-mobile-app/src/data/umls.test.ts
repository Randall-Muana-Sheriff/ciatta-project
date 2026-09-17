// The UMLS client lives beside the edge function (only that directory
// deploys) but is plain TypeScript with no Deno imports, so this suite
// exercises it directly, the same arrangement as paging.ts and links.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SABS,
  crosswalkUrl,
  parseCrosswalk,
  parseSearch,
  searchTerm,
  searchUrl,
  type Fetcher,
} from '../../supabase/functions/seed-concepts/umls';

test('the search url carries every parameter the API requires', () => {
  const url = searchUrl('Heart rate', SABS.loinc, 'KEY');
  assert.ok(url.startsWith('https://uts-ws.nlm.nih.gov/rest/search/current?'), url);
  assert.match(url, /string=Heart\+rate|string=Heart%20rate/);
  assert.match(url, /sabs=LNC/);
  assert.match(url, /returnIdType=sourceUi/);
  assert.match(url, /searchType=exact/);
  assert.match(url, /apiKey=KEY/);
});

test('the crosswalk url uses the path form, not a query parameter', () => {
  const url = crosswalkUrl(SABS.loinc, '8867-4', SABS.snomed, 'KEY');
  assert.ok(url.startsWith('https://uts-ws.nlm.nih.gov/rest/crosswalk/current/source/LNC/8867-4?'), url);
  assert.match(url, /targetSource=SNOMEDCT_US/);
  assert.match(url, /apiKey=KEY/);
});

test('a term with a space and a slash survives into the url', () => {
  const url = searchUrl('Heart rate --resting', SABS.loinc, 'KEY');
  assert.ok(!url.includes(' '), 'no raw spaces in a url');
});

test('parseSearch reads the nested result.results shape', () => {
  const hits = parseSearch({
    pageSize: 200,
    result: { classType: 'searchResults', results: [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate', uri: 'x' }] },
  });
  assert.deepEqual(hits, [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }]);
});

test('parseCrosswalk reads the flat result shape, which differs from search', () => {
  const hits = parseCrosswalk({
    pageSize: 25,
    result: [{ classType: 'SourceAtomCluster', ui: '1776003', rootSource: 'SNOMEDCT_US', name: 'Renal tubular acidosis' }],
  });
  assert.deepEqual(hits, [{ ui: '1776003', rootSource: 'SNOMEDCT_US', name: 'Renal tubular acidosis' }]);
});

test('a NONE result is no hits, never a fabricated one', () => {
  assert.deepEqual(parseSearch({ result: { results: [{ ui: 'NONE', rootSource: '', name: 'NO RESULTS' }] } }), []);
});

test('a malformed body is no hits rather than a throw', () => {
  assert.deepEqual(parseSearch({}), []);
  assert.deepEqual(parseSearch(null), []);
  assert.deepEqual(parseCrosswalk({ result: 'not an array' }), []);
});

test('each parser reads only its own shape, so one is never read with the other', () => {
  // The crosswalk body read by the search parser, and the reverse. Both are
  // empty, which is why a mixed up parser looks like "no concept found"
  // rather than like a bug, and why these two assertions are here.
  const crosswalkBody = {
    result: [{ ui: '1776003', rootSource: 'SNOMEDCT_US', name: 'Renal tubular acidosis' }],
  };
  const searchBody = {
    result: { results: [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }] },
  };
  assert.deepEqual(parseSearch(crosswalkBody), []);
  assert.deepEqual(parseCrosswalk(searchBody), []);
});

test('searchTerm returns hits on a 200', async () => {
  const fetcher: Fetcher = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ result: { results: [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }] } }),
  });
  const hits = await searchTerm(fetcher, 'Heart rate', SABS.loinc, 'KEY');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].ui, '8867-4');
});

test('a non 200 throws rather than returning an empty list, because empty would read as not found', async () => {
  const fetcher: Fetcher = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(() => searchTerm(fetcher, 'Heart rate', SABS.loinc, 'KEY'), /503/);
});

// Deno and Node fail a network level request differently, and the difference
// is the whole reason for the tests below. Node's undici rejects with a cause
// reading `getaddrinfo ENOTFOUND example.invalid`, which carries no URL, so a
// fetcher that rejects the Node way would pass whether or not the client
// sanitizes anything. Deno rejects with the full request URL in the message
// and again in the cause, and that URL carries the API key as a query
// parameter. This builds the Deno shape so the guard is actually pinned.
function denoStyleNetworkError(): unknown {
  const leakyUrl =
    'https://uts-ws.nlm.nih.gov/rest/search/current?string=Heart+rate&sabs=LNC' +
    '&returnIdType=sourceUi&searchType=exact&apiKey=SECRETKEY';
  const detail = `error sending request for url (${leakyUrl}): client error (Connect): dns error`;
  return Object.assign(new TypeError(detail), { cause: new Error(detail) });
}

// Every string an ordinary caller could reach: the message, and the message of
// everything down the cause chain. `console.error(e)` prints all of it.
function everyStringReachableFrom(err: unknown): string[] {
  const out: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < 10 && current instanceof Error; depth += 1) {
    out.push(current.message);
    out.push(String(current));
    current = (current as { cause?: unknown }).cause;
  }
  if (typeof current === 'string') out.push(current);
  return out;
}

test('the simulated Deno error really does carry the key, so the next test is not vacuous', () => {
  const reachable = everyStringReachableFrom(denoStyleNetworkError());
  assert.ok(
    reachable.some((s) => s.includes('SECRETKEY')),
    'the fixture must leak, or the guard it exercises proves nothing'
  );
});

test('a network level rejection is sanitized, so no key reaches the message or the cause chain', async () => {
  const fetcher: Fetcher = async () => {
    throw denoStyleNetworkError();
  };
  await assert.rejects(
    () => searchTerm(fetcher, 'Heart rate', SABS.loinc, 'SECRETKEY'),
    (e: Error) => {
      for (const reachable of everyStringReachableFrom(e)) {
        assert.ok(!reachable.includes('SECRETKEY'), `the key reached a caller readable string: ${reachable}`);
        assert.ok(!reachable.includes('apiKey='), `a key bearing url reached a caller readable string: ${reachable}`);
      }
      assert.match(e.message, /did not complete/);
      return true;
    }
  );
});

test('a body that fails to read is sanitized the same way, because it is the same client and the same url', async () => {
  const fetcher: Fetcher = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw denoStyleNetworkError();
    },
  });
  await assert.rejects(
    () => searchTerm(fetcher, 'Heart rate', SABS.loinc, 'SECRETKEY'),
    (e: Error) => {
      for (const reachable of everyStringReachableFrom(e)) {
        assert.ok(!reachable.includes('SECRETKEY'), `the key reached a caller readable string: ${reachable}`);
        assert.ok(!reachable.includes('apiKey='), `a key bearing url reached a caller readable string: ${reachable}`);
      }
      return true;
    }
  );
});

test('the thrown message carries the status but never the key', async () => {
  const fetcher: Fetcher = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => searchTerm(fetcher, 'Heart rate', SABS.loinc, 'SECRETKEY'),
    (e: Error) => {
      assert.match(e.message, /401/);
      assert.ok(!e.message.includes('SECRETKEY'), 'the key must never reach an error message');
      return true;
    }
  );
});
