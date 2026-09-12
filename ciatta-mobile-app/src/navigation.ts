import { createContext, useContext } from 'react';

export type Tab = 'today' | 'myhealth' | 'profile';

export type Screen =
  | 'insight'
  | 'sleep'
  | 'cycle'
  | 'symptoms'
  | 'medications'
  | 'journal'
  | 'healthrecords';

export type Nav = {
  tab: Tab;
  push: (screen: Screen) => void;
  back: () => void;
  // Switch tabs, optionally landing on a detail screen inside the new tab.
  goTab: (tab: Tab, then?: Screen) => void;
};

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside NavContext');
  return nav;
}
