import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// The order the connect sequence runs in, asserted against the source.
//
// connectHealth.ts imports the HealthKit native module, so it cannot be
// loaded in node and the sequence cannot be exercised here. Reading the file
// is a blunt instrument and it is the right one for this: the bug it guards
// shipped once, and it was invisible in every unit test because it was not a
// wrong value anywhere, only two correct calls in the wrong order.

const SOURCE = readFileSync('src/lib/connectHealth.ts', 'utf8');

test('the permission request goes out before the caller is told no sheet is coming', () => {
  // The bug: onAskState fires first, the screen opens the Health app on a
  // false, Ciatta is backgrounded, and the sheet she was waiting for never
  // gets asked for. Apple's sheet is the only thing that can grant access,
  // so nothing may come between the tap and the request.
  const request = SOURCE.indexOf('await requestHealthPermission()');
  const ask = SOURCE.indexOf('onAskState?.(willAsk)');

  assert.ok(request > 0, 'the permission request is gone');
  assert.ok(ask > 0, 'the ask state callback is gone');
  assert.ok(
    request < ask,
    'onAskState runs before requestHealthPermission, so the caller can background the app before iOS is asked',
  );
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
