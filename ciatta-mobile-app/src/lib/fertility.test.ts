import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, emptyForm, formToEpisode, isoDay, sampleCycleStarts, sampleEpisodes } from '../data/cycleLog';
import { sampleDays } from '../data/daily';
import { cycleWindows, periodStarts, regularity } from './cycleModel';
import { type CycleProfile, SAMPLE_PROFILE } from './cycleProfile';
import { estimateFertility, fmtRange, lutealLength, temperatureOvulation } from './fertility';

const NOW = new Date(2026, 8, 15);
const day = (ago: number) => addDays(NOW, -ago);
const profile = (p: Partial<CycleProfile>): CycleProfile => ({ situations: [], setupDone: true, ...p });
// Nightly temperatures from `from` days ago to today, 0.3 higher from `riseAgo`.
const temps = (from: number, riseAgo: number | null) =>
  Array.from({ length: from + 1 }, (_, i) => {
    const ago = from - i;
    return { date: isoDay(day(ago)), tempDeviation: riseAgo != null && ago <= riseAgo ? 0.25 : -0.05 };
  });
function steady(lengths: number[], currentAgo = 11) {
  let ago = currentAgo;
  const starts = [day(ago)];
  for (const l of [...lengths].reverse()) {
    ago += l;
    starts.unshift(day(ago));
  }
  return cycleWindows(starts);
}
const estimate = (p: CycleProfile, windows: ReturnType<typeof cycleWindows>, days = [] as ReturnType<typeof temps>, episodes = [] as ReturnType<typeof sampleEpisodes>) =>
  estimateFertility({ profile: p, windows, regularity: regularity(windows, p), days, episodes });

test('a sustained rise confirms ovulation the day before it', () => {
  const [w] = cycleWindows([day(40), day(10)]);
  assert.equal(isoDay(temperatureOvulation(temps(45, 22), w)!), isoDay(day(23)));
});

test('no rise, or one warm night, confirms nothing', () => {
  const [w] = cycleWindows([day(40), day(10)]);
  assert.equal(temperatureOvulation(temps(45, null), w), null);
  const spike = temps(45, null).map((d) => (d.date === isoDay(day(20)) ? { ...d, tempDeviation: 0.4 } : d));
  assert.equal(temperatureOvulation(spike, w), null);
});

test('a missing night breaks three nights in a row', () => {
  const [w] = cycleWindows([day(40), day(10)]);
  const riseDates = new Set([22, 21, 19].map((ago) => isoDay(day(ago))));
  const missing = temps(45, null)
    .filter((d) => d.date !== isoDay(day(20)))
    .map((d) => (riseDates.has(d.date) ? { ...d, tempDeviation: 0.25 } : d));
  assert.equal(temperatureOvulation(missing, w), null);

  const controlDates = new Set([22, 21, 20, 19].map((ago) => isoDay(day(ago))));
  const control = temps(45, null).map((d) => (controlDates.has(d.date) ? { ...d, tempDeviation: 0.25 } : d));
  assert.equal(isoDay(temperatureOvulation(control, w)!), isoDay(day(23)));
});

test('luteal length is learned from confirmed cycles, 14 without them', () => {
  const windows = cycleWindows([day(70), day(40), day(10)]);
  assert.equal(lutealLength(windows, []), 14);
  const past = [
    { cycle: 0, date: day(52), source: 'temperature' as const },
    { cycle: 1, date: day(22), source: 'temperature' as const },
  ];
  assert.equal(lutealLength(windows, past), 12);
});

test('steady cycles without confirmations give a medium calendar estimate', () => {
  const f = estimate(profile({ situations: ['Regular'] }), steady([28, 28, 28]));
  assert.equal(f.show, true);
  assert.equal(f.confidence, 'Medium');
  assert.equal(isoDay(f.ovulation!.start), isoDay(addDays(day(11), 13)));
  assert.equal(isoDay(f.ovulation!.end), isoDay(addDays(day(11), 15)));
  assert.equal(isoDay(f.fertile!.start), isoDay(addDays(day(11), 9)));
  assert.equal(isoDay(f.fertile!.end), isoDay(addDays(day(11), 15)));
});

test('the sample record learns a 13 day luteal length and gives a wide low window', () => {
  const episodes = sampleEpisodes(NOW);
  const windows = cycleWindows(periodStarts(episodes));
  const f = estimateFertility({
    profile: SAMPLE_PROFILE,
    windows,
    regularity: regularity(windows, SAMPLE_PROFILE),
    days: sampleDays(NOW),
    episodes,
  });
  const current = sampleCycleStarts(NOW)[4];
  assert.equal(f.luteal, 13);
  assert.equal(f.past.filter((o) => o.source === 'temperature').length, 4);
  assert.equal(f.confidence, 'Low');
  assert.equal(isoDay(f.ovulation!.start), isoDay(addDays(current, 26 - 13)));
  assert.equal(isoDay(f.ovulation!.end), isoDay(addDays(current, 41 - 13)));
});

test('a positive ovulation test this cycle narrows the window', () => {
  const test = formToEpisode({ ...emptyForm(), kinds: ['Symptoms'], symptoms: ['Positive ovulation test'], day: 3 }, false, NOW);
  const f = estimate(profile({ situations: ['Irregular'] }), steady([26, 41, 30]), [], [test]);
  assert.equal(f.confidence, 'Higher');
  assert.equal(isoDay(f.ovulation!.start), isoDay(day(2)));
  assert.equal(isoDay(f.ovulation!.end), isoDay(day(1)));
});

test('a temperature rise this cycle confirms it', () => {
  const f = estimate(profile({ situations: ['Irregular'] }), steady([26, 41, 30], 20), temps(40, 3));
  assert.equal(f.confirmedThisCycle, true);
  assert.equal(isoDay(f.ovulation!.start), isoDay(day(4)));
});

test('hidden with a reason on hormonal contraception or with no periods, silently when switched off', () => {
  assert.match(estimate(profile({ situations: ['Hormonal contraception'] }), steady([28, 28, 28])).hiddenReason!, /stops ovulation/);
  assert.equal(estimate(profile({ situations: ['No periods right now'] }), steady([28, 28, 28])).show, false);
  const off = estimate(profile({ situations: ['Regular'], showFertility: false }), steady([28, 28, 28]));
  assert.equal(off.show, false);
  assert.equal(off.hiddenReason, null);
});

test('postpartum shows no calendar window until two periods return', () => {
  // Periods started 95, 67, 39 and 11 days ago; only the last is after birth.
  const f = estimate(profile({ situations: ['Postpartum'], birthDate: isoDay(day(30)) }), steady([28, 28, 28]));
  assert.equal(f.show, true);
  assert.equal(f.fertile, null);
  assert.match(f.notes[0], /before your first period/);
});

test('postpartum with two periods back uses only post birth cycles for the window', () => {
  // Starts 269, 241, 41 and 11 days ago: 28 and 200 day gaps before the birth
  // 60 days ago, then one 30 day cycle and the current one after it.
  const f = estimate(profile({ situations: ['Postpartum'], birthDate: isoDay(day(60)) }), steady([28, 200, 30]));
  assert.equal(f.confidence, 'Low');
  assert.equal(isoDay(f.ovulation!.start), isoDay(addDays(day(11), 30 - 14)));
  assert.equal(isoDay(f.ovulation!.end), isoDay(addDays(day(11), 30 - 14)));
  assert.equal(isoDay(f.fertile!.end), isoDay(addDays(day(11), 30 - 14 + 1)));
});

test('postpartum with no period since birth still shows a positive test', () => {
  const positive = formToEpisode({ ...emptyForm(), kinds: ['Symptoms'], symptoms: ['Positive ovulation test'], day: 3 }, false, NOW);
  const f = estimate(profile({ situations: ['Postpartum'], birthDate: isoDay(day(60)) }), [], [], [positive]);
  assert.equal(f.show, true);
  assert.equal(f.confidence, 'Higher');
  assert.equal(isoDay(f.ovulation!.start), isoDay(day(2)));
  assert.equal(isoDay(f.ovulation!.end), isoDay(day(1)));
  assert.equal(isoDay(f.fertile!.start), isoDay(day(7)));
  assert.equal(isoDay(f.fertile!.end), isoDay(day(0)));
});

test('postpartum with no period since birth and no signs shows the postpartum note', () => {
  const f = estimate(profile({ situations: ['Postpartum'], birthDate: isoDay(day(60)) }), []);
  assert.equal(f.show, true);
  assert.equal(f.hiddenReason, null);
  assert.equal(f.fertile, null);
  assert.equal(f.ovulation, null);
  assert.match(f.notes[0], /before your first period/);
  // Periods logged only before the birth read the same way.
  const pre = estimate(profile({ situations: ['Postpartum'], birthDate: isoDay(day(5)) }), steady([28, 28, 28]));
  assert.equal(pre.fertile, null);
  assert.match(pre.notes[0], /before your first period/);
});

test('PCOS / PMOS adds a note about ovulation tests', () => {
  const f = estimate(profile({ situations: ['PCOS / PMOS'] }), steady([26, 41, 30]));
  assert.ok(f.notes.some((n) => /read positive without ovulation/.test(n)));
});

test('fmtRange writes ranges in plain words', () => {
  assert.equal(fmtRange(new Date(2026, 8, 18), new Date(2026, 8, 23)), '18 to 23 Sep');
  assert.equal(fmtRange(new Date(2026, 8, 28), new Date(2026, 9, 3)), '28 Sep to 3 Oct');
  assert.equal(fmtRange(new Date(2026, 8, 28), new Date(2026, 8, 28)), '28 Sep');
});
