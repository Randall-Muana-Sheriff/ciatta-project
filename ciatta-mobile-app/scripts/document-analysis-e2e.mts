// The document-analysis function end to end on this machine, with the
// model replaced by a fake (no OpenAI call).
//
// Needs `supabase start`, and in another terminal:
//   supabase functions serve --env-file scripts/lab-analysis-e2e.env
// Run: npm run e2e:document-analysis

import { execSync } from 'node:child_process';

const local = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const API: string = local.API_URL;
const ANON: string = local.ANON_KEY;
const SERVICE: string = local.SERVICE_ROLE_KEY;
const PASSWORD = 'document-analysis-e2e-1';
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function user(tag: string) {
  const email = `document-analysis-e2e-${tag}-${Date.now()}@example.com`;
  const made = await fetch(`${API}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }) }).then((r) => r.json());
  const session = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }).then((r) => r.json());
  return { id: made.id as string, jwt: session.access_token as string };
}

const asHer = (jwt: string) => ({ apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' });

async function analyse(jwt: string, documentId: string, fake: string) {
  const res = await fetch(`${API}/functions/v1/document-analysis`, {
    method: 'POST',
    headers: { ...asHer(jwt), 'x-fake-model': fake },
    body: JSON.stringify({ documentId, cycle: { day: 3, phase: 'During period', usual_length: 29 } }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function stored(jwt: string): Promise<number> {
  const rows = await fetch(`${API}/rest/v1/document_analyses?select=id`, { headers: asHer(jwt) }).then((r) => r.json());
  return Array.isArray(rows) ? rows.length : -1;
}

async function main() {
  const her = await user('her');
  const other = await user('other');
  try {
    const doc = await fetch(`${API}/rest/v1/rpc/save_document`, {
      method: 'POST',
      headers: asHer(her.jwt),
      body: JSON.stringify({
        p_doc_type: 'visit',
        p_title: 'After Visit Summary',
        p_occurred_on: '2026-09-02',
        p_storage_path: `${her.id}/documents/e2e.pdf`,
        p_metadata: { checksum: 'e2e', extraction: { doc_type: 'visit', date: '2026-09-02', visit: { reason: 'Pelvic pain', diagnoses: [{ name: 'Endometriosis', status: 'new' }], instructions: [] } } },
        p_filings: {},
        p_insurance: null,
      }),
    }).then((r) => r.json());
    check('a document to analyse was saved', typeof doc === 'string', JSON.stringify(doc));

    const good = await analyse(her.jwt, doc, 'good');
    check('a faithful analysis is stored and returned', good.status === 200 && good.body?.analysis?.findings?.[0]?.item === 'Endometriosis', `${good.status}`);
    check('it carries the model and a fingerprint', !!good.body?.model && typeof good.body?.facts_hash === 'string');
    check('she can read it back', (await stored(her.jwt)) === 1);

    const retried = await analyse(her.jwt, doc, 'bad-then-good');
    check('a refused answer is retried once and the second is stored', retried.status === 200 && (await stored(her.jwt)) === 2, `${retried.status}`);

    const refused = await analyse(her.jwt, doc, 'always-bad');
    check('an answer that never passes is not stored, and says so', refused.status === 422 && (await stored(her.jwt)) === 2 && /could not be checked/.test(refused.body?.error ?? ''), `${refused.status}`);

    const direct = await fetch(`${API}/rest/v1/rpc/store_document_analysis`, {
      method: 'POST',
      headers: asHer(her.jwt),
      body: JSON.stringify({ p_user: her.id, p_document: doc, p_model: 'gpt-4o', p_facts_hash: 'x', p_analysis: { summary: 'Anything at all' } }),
    });
    check('she cannot store an unchecked analysis by calling the database directly', !direct.ok && (await stored(her.jwt)) === 2, `${direct.status}`);

    const card = await fetch(`${API}/rest/v1/rpc/save_document`, {
      method: 'POST',
      headers: asHer(her.jwt),
      body: JSON.stringify({ p_doc_type: 'insurance', p_title: 'Card', p_occurred_on: '2026-09-02', p_storage_path: `${her.id}/documents/card.jpg`, p_metadata: { extraction: { doc_type: 'insurance', insurance: { provider: 'Aetna', plan: null, member_id: 'W1' } } }, p_filings: {}, p_insurance: null }),
    }).then((r) => r.json());
    const cardRes = await analyse(her.jwt, card, 'good');
    check('an insurance card is not analysed, so its member id is not sent anywhere', cardRes.status === 422 && (await stored(her.jwt)) === 2, `${cardRes.status}`);

    const theirs = await analyse(other.jwt, doc, 'good');
    check('someone else cannot analyse her document', theirs.status === 404 && (await stored(other.jwt)) === 0, `${theirs.status}`);
  } finally {
    for (const u of [her, other]) await fetch(`${API}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: admin });
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
