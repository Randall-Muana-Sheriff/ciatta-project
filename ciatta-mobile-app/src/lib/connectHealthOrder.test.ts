import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// What the connect sequence may and may not do, asserted against the source.
//
// connectHealth.ts imports the HealthKit native module, so it cannot be
// loaded in node and the sequence cannot be exercised here. Reading the file
// is a blunt instrument and the right one for this: the bug it guards
// shipped twice, and both times it was invisible to every unit test because
// nothing held a wrong value. The sequence simply did the right things in an
// order that stopped Apple's sheet from ever appearing.

const SOURCE = readFileSync('src/lib/connectHealth.ts', 'utf8');

test('nothing navigates away from Ciatta during a connect', () => {
  // The regression this guards shipped twice. Opening the Health app when no
  // sheet is coming backgrounds Ciatta, and the button that exists to raise
  // Apple's sheet stops raising it. If a route out of the app is wanted
  // again, it belongs after the attempt and behind something she taps.
  assert.ok(!/openURL|openSettings/.test(SOURCE), 'the connect sequence navigates away on its own');
  assert.ok(!/onAskState/.test(SOURCE), 'the callback that drove the navigation is back');
});

test('the request is not made conditional on willAsk', () => {
  // iOS is the only thing that knows whether a sheet is due, and it decides
  // per type: adding metrics makes the sheet reappear for the new ones. A
  // guard around the request would throw that away, and willAsk reports
  // unknown as no, so the guard would also fail closed.
  const line = SOURCE.split('\n').find((l) => l.includes('await requestHealthPermission()'));
  assert.ok(line, 'the permission request is gone');
  assert.ok(
    /^\s*const permission = await requestHealthPermission\(\);\s*$/.test(line),
    `the request is wrapped in something: ${line.trim()}`,
  );
});

// ── An interrupted read must not leave a status that lies ───────────
//
// The sequence writes 'connected' before the read and the real status
// after it. 'connected' means "mid read", and every screen treats anything
// but 'active' as not connected. So backgrounding the app during a read of
// every metric HealthKit offers left the source saying mid read forever.
//
// This account spent the session that way: 5017 observations had landed and
// Apple Health still showed as unconnected, which is the same class of bug
// the tests above guard, and invisible to a unit test for the same reason.
// Nothing held a wrong value. The sequence simply stopped early.

test('the status is promoted as soon as a reading lands, not only at the end', () => {
  assert.ok(
    /promoted|promote/.test(SOURCE),
    'nothing promotes the status mid read, so an interrupted read leaves it saying mid read',
  );
  const line = SOURCE.split('\n').find((l) => l.includes('progress.posted'));
  assert.ok(line, 'the promotion is not gated on anything actually having posted');
  assert.ok(/posted > 0/.test(line as string), `gate should be posted > 0, found: ${line?.trim()}`);
});

test('the promotion happens once, so a long read does not write on every metric', () => {
  assert.ok(/if \(promoted\) return;/.test(SOURCE), 'the promotion is not guarded against repeating');
});

test('the promotion claims active only, never a status it has not earned', () => {
  const promo = SOURCE.slice(SOURCE.indexOf('const promote'), SOURCE.indexOf('const result = await runHealthSync'));
  assert.ok(promo.includes("'active'"), 'promote should write active');
  for (const wrong of ["'error'", "'refused'", "'unsupported'"]) {
    assert.ok(!promo.includes(wrong), `promote must not write ${wrong}`);
  }
});
