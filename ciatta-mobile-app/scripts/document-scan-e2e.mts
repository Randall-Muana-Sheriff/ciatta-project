// document-scan end to end on this machine, with the model replaced by a
// fake. Needs `supabase start` and, in another terminal:
//   supabase functions serve --env-file scripts/lab-analysis-e2e.env
// Run: npm run e2e:document-scan

import { execSync } from 'node:child_process';

const local = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const API: string = local.API_URL;
const ANON: string = local.ANON_KEY;
const SERVICE: string = local.SERVICE_ROLE_KEY;
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function main() {
  const email = `document-scan-e2e-${Date.now()}@example.com`;
  const made = await fetch(`${API}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: 'document-scan-1', email_confirm: true }) }).then((r) => r.json());
  const session = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'document-scan-1' }),
  }).then((r) => r.json());
  const call = async (body: unknown, fake = '1') => {
    const res = await fetch(`${API}/functions/v1/document-scan`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'x-fake-model': fake },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const visit = await call({ file: 'aGVsbG8=', kind: 'image' });
    check('a document is read and comes back typed', visit.status === 200 && visit.body?.doc_type === 'visit' && visit.body?.visit?.diagnoses?.length === 1, `${visit.status}`);
    const asked = await call({ file: 'aGVsbG8=', kind: 'image', as: 'insurance' });
    check('read again as the type she chose', asked.status === 200 && asked.body?.doc_type === 'insurance' && asked.body?.insurance?.provider === 'Aetna');
    const bad = await call({ file: '', kind: 'image' });
    check('an empty file is refused', bad.status === 400);
    const unsigned = await fetch(`${API}/functions/v1/document-scan`, { method: 'POST', body: '{}' });
    check('an unsigned call is refused', unsigned.status === 401);
  } finally {
    await fetch(`${API}/auth/v1/admin/users/${made.id}`, { method: 'DELETE', headers: admin });
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
