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
