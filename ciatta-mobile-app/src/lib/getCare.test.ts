import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GET_CARE } from './getCare';

test('Get care lists the five, in the order the row shows them', () => {
  assert.deepEqual(GET_CARE.map((g) => g.label), ['Report symptom', 'Get lab tests', 'Consult doctor', 'Request prescription', 'Get diagnosed']);
});

test('each opens the chat: Report symptom with Ciatta asking, the rest with her question asked', () => {
  const report = GET_CARE[0];
  assert.equal(report.ask, null);
  assert.match(report.opener!, /what you are feeling/i);
  for (const g of GET_CARE.slice(1)) {
    assert.ok(g.ask && g.ask.length > 10, g.label);
    assert.equal(g.opener, null, g.label);
  }
});

test('every category lists endometriosis first, then the whole body, each with real choices', () => {
  for (const g of GET_CARE) {
    assert.deepEqual(g.groups.map((x) => x.title), ['Endometriosis', 'Whole body'], g.label);
    for (const group of g.groups) {
      assert.ok(group.items.length >= 5, `${g.label} ${group.title}`);
      for (const item of group.items) assert.ok(item.ask.length > 10, item.label);
    }
  }
});

test('a symptom is said, not asked, so Ciatta offers to log it', () => {
  const symptoms = GET_CARE[0].groups.flatMap((g) => g.items);
  for (const s of symptoms) {
    assert.ok(!s.ask.trim().endsWith('?'), s.ask);
    assert.match(s.ask, /^I (am having|have|had)/);
  }
});

test('the symptom words match what the record logs, so the offer can name them', () => {
  const said = GET_CARE[0].groups[0].items.map((i) => i.label);
  for (const w of ['Pelvic pain', 'Pain with sex', 'Lower back pain', 'Bloating']) assert.ok(said.includes(w), w);
});
