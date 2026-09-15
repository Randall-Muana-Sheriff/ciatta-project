import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { type Episode, type EpisodeForm, sampleEpisodes } from '../data/cycleLog';
import { cycleSummaries, cycleWindows, observations, signals, similarTemplate } from '../lib/cyclePatterns';

// The Cycle record on this device. Episodes persist between launches; until
// someone logs their own, the sample record stands in.

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
};

const CycleContext = createContext<Store | null>(null);

export function CycleStoreProvider({ children }: { children: ReactNode }) {
  const [episodes, setEpisodes] = useState<Episode[]>(() => sampleEpisodes());
  const [watching, setWatchingMap] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Draft>({ mode: 'new', form: {} });
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as { episodes?: Episode[]; watching?: Record<string, boolean> };
        if (saved.episodes?.length) setEpisodes(saved.episodes);
        if (saved.watching) setWatchingMap(saved.watching);
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ episodes, watching })).catch(() => {});
  }, [episodes, watching]);

  const store = useMemo<Store>(
    () => ({
      episodes,
      add: (episode) => setEpisodes((list) => [...list, episode]),
      draft,
      startDraft: (next) => setDraft({ mode: 'new', form: {}, ...next }),
      watching,
      setWatching: (id, on) => setWatchingMap((w) => ({ ...w, [id]: on })),
    }),
    [episodes, draft, watching],
  );

  return <CycleContext.Provider value={store}>{children}</CycleContext.Provider>;
}

export function useCycle(): Store {
  const store = useContext(CycleContext);
  if (!store) throw new Error('useCycle must be used inside CycleStoreProvider');
  return store;
}

// Everything derived from the record: cycle windows, per episode signals,
// per cycle summaries, observations, and the usual episode shape.
export function useCycleInsights() {
  const { episodes } = useCycle();
  return useMemo(() => {
    const windows = cycleWindows();
    const sigs = signals(episodes, windows);
    const summaries = cycleSummaries(sigs, windows);
    return {
      windows,
      signals: sigs,
      summaries,
      observations: observations(sigs, windows, summaries),
      template: similarTemplate(episodes),
    };
  }, [episodes]);
}
