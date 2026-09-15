import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { type Data, dataForSession } from '../data/adapter';
import { demoRepo, realRepo, type Repo } from '../data/repo';
import { supabase } from '../lib/supabase';

export type Mode = 'loading' | 'signedOut' | 'demo' | 'real';

type SessionValue = {
  mode: Mode;
  userId: string | null;
  repo: Repo | null;
  firstName: string | null;
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

  const value = useMemo<SessionValue>(
    () => ({
      mode,
      userId,
      repo,
      firstName,
      enterDemo: () => setDemo(true),
      signOut: async () => {
        if (demo) setDemo(false);
        else await supabase.auth.signOut();
      },
    }),
    [mode, userId, repo, firstName, demo],
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
  const { mode, firstName } = useSession();
  return useMemo(() => dataForSession(mode, firstName), [mode, firstName]);
}

export function useRepo(): Repo {
  const { repo } = useSession();
  if (!repo) throw new Error('useRepo needs a demo or signed in session');
  return repo;
}
