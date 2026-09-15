import { createContext, useContext } from 'react';

export type Tab = 'today' | 'myhealth' | 'journey' | 'profile';

export const TAB_ORDER: Tab[] = ['today', 'myhealth', 'journey', 'profile'];

// The header arrows step through the tabs, wrapping at either end.
export function adjacentTab(tab: Tab, step: 1 | -1): Tab {
  const n = TAB_ORDER.length;
  return TAB_ORDER[(TAB_ORDER.indexOf(tab) + step + n) % n];
}

export type Screen =
  | 'insight'
  | 'sleep'
  | 'cycle'
  | 'symptoms'
  | 'medications'
  | 'journal'
  | 'healthrecords'
  | 'cycleLog'
  | 'cycleHistory'
  | 'evidence'
  | 'movement'
  | 'cycleProfile';

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
