import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { demoRepo } from './repo';
import { journal, sources } from './sample';

test('demo mode serves the sample and keeps writes in memory', async () => {
  const repo = demoRepo();
  assert.equal(repo.mode, 'demo');
  assert.deepEqual(await repo.loadSources(), sources);
  assert.equal((await repo.loadJournal()).count, journal.count);
  await repo.addJournal('Tired today.', 'Notes');
  assert.equal((await repo.loadJournal()).count, journal.count + 1);
  const ep = formToEpisode({ ...emptyForm(), kinds: ['Pain'] }, false, new Date(2026, 8, 15));
  await repo.saveEpisode(ep);
  assert.deepEqual((await repo.loadEpisodes()).map((e) => e.id), [ep.id]);
  assert.equal(await repo.firstName(), 'Maya');
  assert.equal(demoRepo().mode, 'demo');
  assert.deepEqual(await demoRepo().loadEpisodes(), [], 'a fresh demo starts clean');
});
