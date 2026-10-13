import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lastNight, type SleepSample } from './hypnogram';

const s = (stage: string, end: string, start?: string): SleepSample => ({ stage, end, ...(start ? { start } : {}) });

test('a night of stages, each from its start to its end, with each stage\'s share and time', () => {
  const night = lastNight([
    s('asleep_core', '2026-10-12T00:30:00Z', '2026-10-11T23:00:00Z'),
    s('asleep_deep', '2026-10-12T01:30:00Z', '2026-10-12T00:30:00Z'),
    s('asleep_rem', '2026-10-12T02:00:00Z', '2026-10-12T01:30:00Z'),
    s('awake', '2026-10-12T02:10:00Z', '2026-10-12T02:00:00Z'),
    s('asleep_core', '2026-10-12T06:00:00Z', '2026-10-12T02:10:00Z'),
  ])!;
  assert.equal(night.start, '2026-10-11T23:00:00.000Z');
  assert.equal(night.end, '2026-10-12T06:00:00.000Z');
  assert.deepEqual(night.segments.map((x) => x.stage), ['light', 'deep', 'rem', 'awake', 'light']);
  assert.deepEqual(night.totals, [
    { stage: 'awake', label: 'Awake', minutes: 10, percent: 2 },
    { stage: 'rem', label: 'REM', minutes: 30, percent: 7 },
    { stage: 'light', label: 'Light', minutes: 320, percent: 76 },
    { stage: 'deep', label: 'Deep', minutes: 60, percent: 14 },
  ]);
  assert.equal(night.asleepMinutes, 410);
});

test('a stage without a start begins where the one before it ended; the first one without a start is left out', () => {
  const night = lastNight([
    s('asleep_core', '2026-10-12T00:30:00Z'),
    s('asleep_deep', '2026-10-12T01:30:00Z'),
    s('asleep_rem', '2026-10-12T02:00:00Z'),
  ])!;
  assert.deepEqual(night.segments.map((x) => [x.stage, x.from, x.to]), [
    ['deep', '2026-10-12T00:30:00.000Z', '2026-10-12T01:30:00.000Z'],
    ['rem', '2026-10-12T01:30:00.000Z', '2026-10-12T02:00:00.000Z'],
  ]);
});

test('only the most recent night is drawn: a gap of three hours or more starts a new one', () => {
  const night = lastNight([
    s('asleep_core', '2026-10-11T06:00:00Z', '2026-10-10T23:00:00Z'),
    s('asleep_core', '2026-10-12T06:00:00Z', '2026-10-11T23:30:00Z'),
  ])!;
  assert.equal(night.start, '2026-10-11T23:30:00.000Z');
  assert.equal(night.segments.length, 1);
});

test('in bed without a stage is not drawn as sleep, and a night with no stages is nothing', () => {
  assert.equal(lastNight([s('in_bed', '2026-10-12T06:00:00Z', '2026-10-11T23:00:00Z')]), null);
  assert.equal(lastNight([]), null);
  // Unstaged sleep from a phone alone draws as asleep, not as a stage it is not.
  const plain = lastNight([s('asleep', '2026-10-12T06:00:00Z', '2026-10-11T23:00:00Z')])!;
  assert.deepEqual(plain.segments.map((x) => x.stage), ['asleep']);
  assert.equal(plain.staged, false);
});
