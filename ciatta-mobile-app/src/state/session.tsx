import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { type Data, dataForSession } from '../data/adapter';
import type { Day } from '../data/daily';
import type { InsightView } from '../data/insightRows';
import type { TodayLoop } from '../data/loopRows';
import { demoRepo, realRepo, type Repo } from '../data/repo';
import { supabase } from '../lib/supabase';
import { refreshAppleHealth } from './healthRefresh';

export type Mode = 'loading' | 'signedOut' | 'demo' | 'real';

type SessionValue = {
  mode: Mode;
  userId: string | null;
  repo: Repo | null;
  firstName: string | null;
  days: Day[];
  insight: InsightView | null;
  loop: TodayLoop | null;
  // Read the loop again after she changed it (watched, tried); the since
  // she saw at the start of the session is kept.
  reloadLoop: () => Promise<void>;
  // Read her days and her insight again, after something wrote to her
  // record: a source she has just connected, or a read of one on opening.
  reloadRecord: () => Promise<void>;
  enterDemo: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

// One place decides whose record the app is showing: nobody yet, the example
// person, or hers.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [demo, setDemo] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [insight, setInsight] = useState<InsightView | null>(null);
  const [loop, setLoop] = useState<TodayLoop | null>(null);
  // Which insight this session has already recorded as seen, and for whom
  // the visit has been stamped, so each happens once per session.
  const viewed = useRef<string | null>(null);
  const visited = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const repo = useMemo(() => (demo ? demoRepo() : userId ? realRepo(supabase, userId) : null), [demo, userId]);
  const mode: Mode = demo ? 'demo' : session === undefined ? 'loading' : userId ? 'real' : 'signedOut';

  useEffect(() => {
    let ignore = false;
    setFirstName(null);
    repo?.firstName().then((name) => {
      if (!ignore) setFirstName(name);
    }).catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo]);

  // Real days come from her own record, loaded once here so every screen
  // that reads useData() shares one fetch rather than each mounting its own.
  useEffect(() => {
    let ignore = false;
    setDays([]);
    if (mode === 'real' && repo) {
      repo.loadDays().then((d) => {
        if (!ignore) setDays(d);
      }).catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [mode, repo]);

  // Her newest insight, the same way: once per session, shared by Today
  // and the Insight screen, and cleared before it is asked for again so a
  // previous session's never shows under a new one.
  useEffect(() => {
    let ignore = false;
    setInsight(null);
    if (mode === 'real' && repo) {
      repo.loadInsight().then((view) => {
        if (!ignore) setInsight(view);
      }).catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [mode, repo]);

  // The loop, once per session: read Today's state first (its "since" is
  // computed against her last look and last visit), then record that she
  // has now seen this insight and has now visited, in that order, so the
  // since she is shown is the one that was true when she opened the app.
  useEffect(() => {
    let ignore = false;
    setLoop(null);
    if (mode === 'real' && repo) {
      repo
        .loadToday()
        .then(async (next) => {
          if (ignore) return;
          setLoop(next);
          if (next?.insight && viewed.current !== next.insight.id) {
            viewed.current = next.insight.id;
            await repo.recordInsightView(next.insight.id).catch(() => {});
          }
          if (userId && visited.current !== userId) {
            visited.current = userId;
            await repo.recordVisit().catch(() => {});
          }
        })
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [mode, repo, userId]);

  const reloadLoop = useCallback(async () => {
    if (mode !== 'real' || !repo) return;
    const next = await repo.loadToday().catch(() => null);
    setLoop((prev) =>
      next && prev?.insight && next.insight && next.insight.id === prev.insight.id
        ? { ...next, insight: { ...next.insight, since: prev.insight.since } }
        : next,
    );
  }, [mode, repo]);

  const reloadRecord = useCallback(async () => {
    if (mode !== 'real' || !repo) return;
    // Each is kept as it was when its read fails: a screen never goes
    // empty for want of a signal.
    await Promise.all([
      repo.loadDays().then(setDays).catch(() => {}),
      repo.loadInsight().then(setInsight).catch(() => {}),
    ]);
  }, [mode, repo]);

  // Her record stopped on the day she connected a source unless something
  // reads the source again. So it is read when the app opens and each time
  // it comes back to the front, as often as planRefresh allows, and her
  // days are loaded again once a read has gone through.
  const refreshing = useRef(false);
  useEffect(() => {
    if (mode !== 'real' || !repo || !userId) return;
    let ignore = false;
    const refresh = async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const read = await refreshAppleHealth(userId, repo);
        if (read && !ignore) await reloadRecord();
      } catch {
        // Nothing to say: what she already has stays on screen, and the
        // next time the app comes to the front it tries again.
      } finally {
        refreshing.current = false;
      }
    };
    refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      ignore = true;
      listener.remove();
    };
  }, [mode, repo, userId, reloadRecord]);

  const value = useMemo<SessionValue>(
    () => ({
      mode,
      userId,
      repo,
      firstName,
      days,
      insight,
      loop,
      reloadLoop,
      reloadRecord,
      enterDemo: () => setDemo(true),
      signOut: async () => {
        if (demo) setDemo(false);
        else await supabase.auth.signOut();
      },
    }),
    [mode, userId, repo, firstName, days, insight, loop, reloadLoop, reloadRecord, demo],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

// What screens read. Only the demo reads as the sample person; loading and
// signed out read as an empty record, never as somebody else's.
export function useData(): Data {
  const { mode, firstName, days, insight, loop } = useSession();
  return useMemo(() => dataForSession(mode, firstName, days, insight, loop), [mode, firstName, days, insight, loop]);
}

export function useRepo(): Repo {
  const { repo } = useSession();
  if (!repo) throw new Error('useRepo needs a demo or signed in session');
  return repo;
}
