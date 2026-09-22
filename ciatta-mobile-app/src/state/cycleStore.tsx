import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { addDays, type Episode, type EpisodeForm, isoDay, recordEpisodes, startOfDay } from '../data/cycleLog';
import { importDeviceRecord } from '../data/deviceImport';
import { mergeEpisodes } from '../data/cycleMerge';
import { interventionsFrom, watchingFrom } from '../data/loopRows';
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

// Watching and planned actions: in real mode they are her thread's status
// and her actions on the server, read through the session's loop and
// written through the repo's RPCs, with a local entry held only while a
// write is in flight so the screen answers at once. In demo mode they
// stay in memory. Nothing about them is kept on the phone any more.

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
  const { userId, loop, reloadLoop } = useSession();
  const real = repo.mode === 'real';
  const [own, setOwn] = useState<Episode[]>([]);
  const episodes = useMemo(() => (real ? own : recordEpisodes(own)), [own, real]);
  const [localWatching, setWatchingMap] = useState<Record<string, boolean>>({});
  const [localInterventions, setInterventions] = useState<Intervention[]>(real ? [] : sampleInterventions);
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
      const [mine, savedProfile] = await Promise.all([
        repo.loadEpisodes().catch(() => [] as Episode[]),
        repo.loadCycleProfile().catch(() => null),
      ]);
      if (!alive) return;
      setOwn((prev) => mergeEpisodes(mine, prev));
      if (savedProfile && !profileTouched.current) setProfileState(savedProfile);
      loaded.current = true;
    })();
    return () => {
      alive = false;
    };
  }, [real, repo, userId]);

  // In real mode the server's answer is the truth and a local entry only
  // stands in while a write is in flight.
  const watching = useMemo(() => (real ? { ...watchingFrom(loop), ...localWatching } : localWatching), [real, loop, localWatching]);
  const interventions = useMemo(() => {
    if (!real) return localInterventions;
    const server = interventionsFrom(loop?.actions ?? []);
    const pending = localInterventions.filter((v) => !server.some((s) => s.kind === v.kind && s.date === v.date));
    return [...server, ...pending];
  }, [real, loop, localInterventions]);

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
      setWatching: (id, on) => {
        setWatchingMap((w) => ({ ...w, [id]: on }));
        if (!real || id !== 'nextCycle' || !loop?.insight) return;
        repo
          .setThreadWatch(loop.insight.threadId, on)
          .then(() => reloadLoop())
          .then(() => setWatchingMap(({ [id]: _settled, ...rest }) => rest))
          .catch(() => setWatchingMap(({ [id]: _failed, ...rest }) => rest));
      },
      interventions,
      accept: (kind) => {
        const date = isoDay(new Date());
        setInterventions((list) =>
          list.some((v) => v.kind === kind && v.date === date) ? list : [...list, { id: `${kind}-${Date.now()}`, kind, date }],
        );
        if (!real) return;
        const offer = loop?.recommendations.find((r) => r.type === 'try' && r.status === 'active');
        repo
          .startAction({
            kind,
            title: 'A short walk',
            intent: 'To see whether energy or sleep follow',
            metric: 'steps',
            wanted: 'higher',
            recommendationId: offer?.id,
          })
          .then(() => reloadLoop())
          .then(() => setInterventions((list) => list.filter((v) => !(v.kind === kind && v.date === date))))
          .catch(() => setInterventions((list) => list.filter((v) => !(v.kind === kind && v.date === date))));
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
    [episodes, draft, watching, interventions, focus, profile, repo, userId, real, loop, reloadLoop],
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
