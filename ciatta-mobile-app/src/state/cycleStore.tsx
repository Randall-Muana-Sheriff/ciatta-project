import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { addDays, type Episode, type EpisodeForm, isoDay, normalizeEpisode, recordEpisodes, startOfDay } from '../data/cycleLog';
import { WALK_PLAN_AGO } from '../data/daily';
import { lensFor } from '../lib/cycleLens';
import { countedWindows, cycleWindows, medianLength, periodStarts, regularity } from '../lib/cycleModel';
import { cycleSummaries, observations, signals, similarTemplate } from '../lib/cyclePatterns';
import { type CycleProfile, normalizeProfile, SAMPLE_PROFILE } from '../lib/cycleProfile';
import type { Intervention } from '../lib/engine';
import { estimateFertility } from '../lib/fertility';
import { useData } from './session';

// The record on this device: cycle episodes, which relationships to keep
// watching, and actions the person chose to try. Everything persists between
// launches; until someone logs their own, the sample record stands in.

const KEY = 'ciatta.cycle.v1';

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
  setProfile: (profile: CycleProfile) => void;
};

const CycleContext = createContext<Store | null>(null);

const sampleInterventions = (): Intervention[] => [
  { id: 'sample-walk', kind: 'walk', date: isoDay(addDays(startOfDay(new Date()), -WALK_PLAN_AGO)) },
];

export function CycleStoreProvider({ children }: { children: ReactNode }) {
  // Only the person's own episodes are held and saved. The sample record is
  // added around them until they log a period of their own.
  const [own, setOwn] = useState<Episode[]>([]);
  const episodes = useMemo(() => recordEpisodes(own), [own]);
  const [watching, setWatchingMap] = useState<Record<string, boolean>>({});
  const [interventions, setInterventions] = useState<Intervention[]>(sampleInterventions);
  const [draft, setDraft] = useState<Draft>({ mode: 'new', form: {} });
  const [focus, setFocus] = useState<string | null>(null);
  const [profile, setProfile] = useState<CycleProfile>(SAMPLE_PROFILE);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as {
          episodes?: Episode[];
          watching?: Record<string, boolean>;
          interventions?: Intervention[];
          profile?: unknown;
        };
        // The sample record is rebuilt around today; only the person's own
        // episodes come from storage. Older saves also held sample episodes.
        if (saved.episodes) setOwn(saved.episodes.filter((e) => !e.id.startsWith('sample-')).map(normalizeEpisode));
        if (saved.watching) setWatchingMap(saved.watching);
        if (saved.interventions?.length) setInterventions(saved.interventions);
        const savedProfile = normalizeProfile(saved.profile);
        if (savedProfile) setProfile(savedProfile);
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ episodes: own, watching, interventions, profile })).catch(() => {});
  }, [own, watching, interventions, profile]);

  const store = useMemo<Store>(
    () => ({
      episodes,
      add: (episode) => setOwn((list) => [...list, episode]),
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
      setProfile,
    }),
    [episodes, draft, watching, interventions, focus, profile],
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
