// Saving a log, in one place: the Log screen and the You can box on Today
// file an entry the same way. Words, taps, a stool type and files are read
// into a plan (lib/quickLog) and each part is saved where the record reads
// it: the day's row, the journal, or a cycle episode.

import { useCallback } from 'react';

import type { Attachment } from '../lib/attachments';
import { emptyForm, formToEpisode } from '../data/cycleLog';
import { BOWEL, type CategoryKey, symptomCategory } from '../lib/logCategories';
import { planSave, runSave } from '../lib/quickLog';
import { useCycle } from './cycleStore';
import { useRepo } from './session';

export type QuickEntry = { text: string; key: CategoryKey; tapped: string[]; files?: Attachment[]; stool?: number | null };

export function useQuickLogSave() {
  const repo = useRepo();
  const { add } = useCycle();
  // Returns false when there was nothing to save. `done` keeps what already
  // landed, so a retry after a failure saves no part twice.
  return useCallback(
    async (entry: QuickEntry, done: Set<string> = new Set()): Promise<boolean> => {
      const { text, key, tapped } = entry;
      const files = entry.files ?? [];
      const stool = entry.stool ?? null;
      const withStool = key === 'gut' && stool != null && !tapped.includes(BOWEL) ? [...tapped, BOWEL] : tapped;
      // Under Symptoms, each tap is filed under its own category.
      const byCategory =
        key === 'symptoms'
          ? withStool.reduce<Record<string, string[]>>((acc, item) => {
              const cat = symptomCategory(item);
              acc[cat] = [...(acc[cat] ?? []), item];
              return acc;
            }, {})
          : undefined;
      const plan = planSave({ text, selected: key, tapped: withStool, files, byCategory });
      if (!plan) return false;
      const said = text.trim();
      // The day she said this was: today, yesterday, or a number of days
      // back. Every part of the entry is filed on it.
      const day = new Date();
      day.setDate(day.getDate() - plan.daysAgo);
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const when = plan.daysAgo ? day.toISOString() : undefined;
      const { episode, daily, journal } = plan;
      await runSave(
        {
          daily: daily
            ? () => repo.saveDailyLog({ day: iso, digestion: daily.digestion, ...(plan.wordsGoTo === 'daily' && said ? { note: said } : {}) })
            : undefined,
          journal: journal ? () => repo.addJournal(said, journal.kind, files, { category: journal.category, items: journal.items }, when) : undefined,
          episode: episode
            ? () =>
                add(
                  formToEpisode(
                    {
                      ...emptyForm(),
                      kinds: episode.kinds,
                      stool: key === 'gut' ? stool : null,
                      flow: episode.flow,
                      day: episode.daysAgo,
                      periodStart: episode.daysAgo,
                      context: episode.context,
                      note: plan.wordsGoTo === 'episode' ? said : '',
                      attachments: plan.wordsGoTo === 'episode' ? files : [],
                    },
                    false,
                  ),
                )
            : undefined,
        },
        done,
      );
      return true;
    },
    [repo, add],
  );
}
