import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { addDays, type Episode, type EpisodeForm, isoDay, recordEpisodes, startOfDay } from '../data/cycleLog';
import { importDeviceRecord } from '../data/deviceImport';
import { mergeEpisodes, mergeInterventions, mergeWatching } from '../data/cycleMerge';
import { loopKey } from '../data/localKeys';
import { enqueue, flush } from '../data/outbox';
import { WALK_PLAN_AGO } from '../data/daily';
import { lensFor } from '../lib/cycleLens';
import { countedWindows, cycleWindows, medianLength, periodStarts, regularity } from '../lib/cycleModel';
import { cycleSummaries, observations, signals, similarTemplate } from '../lib/cyclePatterns';
import { type CycleProfile, EMPTY_PROFILE, SAMPLE_PROFILE } from '../lib/cycleProfile';
import type { Intervention } from '../lib/engine';
import { estimateFertility } from '../lib/fertility';
import { useData, useRepo, useSession } from './session';

// The record on this device: cycle episodes, which relationships to keep
// watching, and actions the person chose to try. In real mode, episodes and
// the cycle profile live in her record and are loaded and saved through the
// repo; in demo mode the sample record stands in, held only in memory.

// The watch flags and planned actions stay on this phone until Slice 4 turns
// them into threads and actions. Real mode only; the demo keeps nothing.
// They are kept under the account that chose them (see loopKey), so a second
// person signing in on this phone never inherits what the first watched or
// agreed to try.

export type Draft = { mode: 'new' | 'similar'; form: Partial<EpisodeForm>; focusNote?: boolean };

type Store = {
  episodes: Episode[];
  add: (episode: Episode) => void;
  draft: Draft;
  // Seed the logging flow before pushing it.
  startDraft: (draft?: Partial<Draft>) => void;
  watching: Record<string, boolean>;
  setWatching: (id: string, on: boolean) => void;
  interventions: Intervention[];
  // Plan an action for today, so what follows can be observed.
  accept: (kind: Intervention['kind']) => void;
  // The insight the Evidence screen opens on.
  focus: string | null;
  setFocus: (id: string | null) => void;
  // What the person told us about their cycle.
  profile: CycleProfile;
  // done is called once the save has settled: with null when it was kept, or
  // with the error when it was not, so the screen she changed it on can say
  // so instead of showing a change that was quietly dropped.
  setProfile: (profile: CycleProfile, done?: (error: unknown) => void) => void;
};

const CycleContext = createContext<Store | null>(null);

const sampleInterventions = (): Intervention[] => [
  { id: 'sample-walk', kind: 'walk', date: isoDay(addDays(startOfDay(new Date()), -WALK_PLAN_AGO)) },
];

export function CycleStoreProvider({ children }: { children: ReactNode }) {
  const repo = useRepo();
  const { userId } = useSession();
  const real = repo.mode === 'real';
  const [own, setOwn] = useState<Episode[]>([]);
  const episodes = useMemo(() => (real ? own : recordEpisodes(own)), [own, real]);
  const [watching, setWatchingMap] = useState<Record<string, boolean>>({});
  const [interventions, setInterventions] = useState<Intervention[]>(real ? [] : sampleInterventions);
  const [draft, setDraft] = useState<Draft>({ mode: 'new', form: {} });
  const [focus, setFocus] = useState<string | null>(null);
  const [profile, setProfileState] = useState<CycleProfile>(real ? EMPTY_PROFILE : SAMPLE_PROFILE);
  const loaded = useRef(false);
  // Set as soon as she changes her profile herself, so a slower initial load
  // landing afterward never overwrites a change she already made and saved.
  const profileTouched = useRef(false);

  useEffect(() => {
    if (!real || !userId) return;
    loaded.current = false;
    let alive = true;
    (async () => {
      try {
        await importDeviceRecord(AsyncStorage, (e, extra) => repo.saveEpisode(e, extra), (p) => repo.saveCycleProfile(p));
      } catch {
        // The device record stays in place and is tried again next launch.
      }
      await flush(AsyncStorage, userId, (e) => repo.saveEpisode(e)).catch(() => 0);
      const [mine, savedProfile, loop] = await Promise.all([
        repo.loadEpisodes().catch(() => [] as Episode[]),
        repo.loadCycleProfile().catch(() => null),
        AsyncStorage.getItem(loopKey(userId)).catch(() => null),
      ]);
      if (!alive) return;
      setOwn((prev) => mergeEpisodes(mine, prev));
      if (savedProfile && !profileTouched.current) setProfileState(savedProfile);
      if (loop) {
        const saved = JSON.parse(loop) as { watching?: Record<string, boolean>; interventions?: Intervention[] };
        setWatchingMap((current) => mergeWatching(saved.watching, current));
        setInterventions((current) => mergeInterventions(saved.interventions, current));
      }
      loaded.current = true;
    })();
    return () => {
      alive = false;
    };
  }, [real, repo, userId]);

  useEffect(() => {
    if (!real || !userId || !loaded.current) return;
    AsyncStorage.setItem(loopKey(userId), JSON.stringify({ watching, interventions })).catch(() => {});
  }, [real, userId, watching, interventions]);

  const store = useMemo<Store>(
    () => ({
      episodes,
      add: (episode) => {
        setOwn((list) => [...list.filter((e) => e.id !== episode.id), episode]);
        repo.saveEpisode(episode).catch(() => {
          // Queued under the account that logged it, never device wide.
          if (userId) enqueue(AsyncStorage, userId, episode).catch(() => {});
        });
      },
      draft,
      startDraft: (next) => setDraft({ mode: 'new', form: {}, ...next }),
      watching,
      setWatching: (id, on) => setWatchingMap((w) => ({ ...w, [id]: on })),
      interventions,
      accept: (kind) => {
        const date = isoDay(new Date());
        setInterventions((list) =>
          list.some((v) => v.kind === kind && v.date === date) ? list : [...list, { id: `${kind}-${Date.now()}`, kind, date }],
        );
      },
      focus,
      setFocus,
      profile,
      setProfile: (next, done) => {
        profileTouched.current = true;
        setProfileState(next);
        repo
          .saveCycleProfile(next)
          .then(() => done?.(null))
          .catch((e) => done?.(e));
      },
    }),
    [episodes, draft, watching, interventions, focus, profile, repo, userId],
  );

  return <CycleContext.Provider value={store}>{children}</CycleContext.Provider>;
}

export function useCycle(): Store {
  const store = useContext(CycleContext);
  if (!store) throw new Error('useCycle must be used inside CycleStoreProvider');
  return store;
}

// Everything derived from the cycle record: cycle windows, per episode
// signals, per cycle summaries, observations, and the usual episode shape.
export function useCycleInsights() {
  const { episodes, profile } = useCycle();
  const { days } = useData();
  const today = isoDay(new Date());
  return useMemo(() => {
    const windows = cycleWindows(periodStarts(episodes));
    const reg = regularity(windows, profile);
    const sigs = signals(episodes, windows, reg === 'predictable' ? medianLength(countedWindows(windows, profile)) : null);
    const summaries = cycleSummaries(sigs, windows);
    return {
      windows,
      signals: sigs,
      summaries,
      observations: observations(sigs, windows, summaries),
      template: similarTemplate(episodes),
      profile,
      regularity: reg,
      lens: lensFor({ profile, windows, regularity: reg }),
      fertility: estimateFertility({ profile, windows, regularity: reg, days, episodes }),
    };
  }, [episodes, profile, days, today]);
}
