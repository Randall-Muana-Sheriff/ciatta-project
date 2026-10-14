import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMetrics, headlineMetrics } from './allMetrics';
import { CATEGORIES } from './logCategories';
import { METRIC_TITLE } from './metricDetail';
import { GROUP, GROUP_ORDER, NAME, SHORT } from './metricNames';
import { bloodOxygen, bloodPressure } from './vitals';

test('one name per metric: the detail screen, the list and the vitals all use it', () => {
  assert.equal(METRIC_TITLE.hrv, NAME.hrv);
  assert.equal(METRIC_TITLE.temp, NAME.temp);
  assert.equal(bloodPressure([], new Date()).label, NAME.bp);
  assert.equal(bloodOxygen([], new Date()).label, NAME.spo2);
  const rows = buildMetrics(null).flatMap((g) => g.rows.map((r) => r.label));
  for (const n of [NAME.hrv, NAME.rhr, NAME.temp, NAME.steps, NAME.timeAsleep]) assert.ok(rows.includes(n), n);
});

test('Today shortens only where a third of a row cannot hold the name', () => {
  assert.deepEqual(headlineMetrics([]).map((m) => m.label), [NAME.sleep, SHORT.hrv, SHORT.rhr, NAME.steps, SHORT.bp, SHORT.spo2]);
});

test('the list groups are the app\'s groups, in its order, named as the Log names them', () => {
  const titles = buildMetrics(null).map((g) => g.title);
  assert.deepEqual(titles, GROUP_ORDER.filter((g) => titles.includes(g)));
  const logLabels = CATEGORIES.map((c) => c.label);
  for (const g of [GROUP.mind, GROUP.nutrition, GROUP.gut]) assert.ok(logLabels.includes(g), g);
});
