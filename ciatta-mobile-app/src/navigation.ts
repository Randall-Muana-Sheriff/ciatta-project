import { createContext, useContext } from 'react';

import type { IconName } from './ui/icons';

// Four places. Journey is a screen now, reached from Today's patterns and
// from Health, rather than a place of its own.
export type Tab = 'today' | 'myhealth' | 'records' | 'care';

export const TAB_ORDER: Tab[] = ['today', 'myhealth', 'records', 'care'];

// The header arrows step through the tabs, wrapping at either end.
export function adjacentTab(tab: Tab, step: 1 | -1): Tab {
  const n = TAB_ORDER.length;
  return TAB_ORDER[(TAB_ORDER.indexOf(tab) + step + n) % n];
}

export type Screen =
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
  | 'cycleProfile'
  | 'appointment'
  | 'metrics'
  | 'providerConnect'
  | 'chart'
  | 'dailyLog'
  | 'profile'
  | 'calendar'
  | 'quickLog'
  | 'nutritionTargets'
  | 'foodScan'
  | 'procedure'
  | 'addProcedure'
  | 'addRecord'
  | 'metric'
  | 'privacy'
  | 'insurance'
  | 'lab'
  | 'labReport'
  | 'addLabs'
  | 'addDocument'
  | 'document'
  | 'visitPrep'
  | 'labBrief'
  | 'referrals'
  | 'referral'
  | 'bodyMeasurements'
  | 'shareClinician'
  | 'productSafety'
  | 'gut'
  | 'journey'
  | 'patterns'
  | 'ciatta'
  | 'explore'
  | 'exploreAll'
  | 'careRequest'
  | 'clinician'
  | 'insight'
  | 'bookmarks';

export type Nav = {
  tab: Tab;
  // How many detail screens are open over the tab. A tab screen stays
  // mounted under them, so it reads this to know it is in view again.
  depth: number;
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

// The corner menu, in the order it lists. Profile is somewhere she goes,
// not a place she switches between, so it opens over the current place.
export type MenuGo = { kind: 'tab'; tab: Tab } | { kind: 'screen'; screen: Screen };
export type MenuItem = { key: string; label: string; icon: IconName; go: MenuGo };

export const MENU_ITEMS: MenuItem[] = [
  { key: 'today', label: 'Today', icon: 'home', go: { kind: 'tab', tab: 'today' } },
  { key: 'myhealth', label: 'Body', icon: 'heart', go: { kind: 'tab', tab: 'myhealth' } },
  { key: 'records', label: 'Records', icon: 'doc', go: { kind: 'tab', tab: 'records' } },
  { key: 'care', label: 'Care', icon: 'concierge', go: { kind: 'tab', tab: 'care' } },
  { key: 'profile', label: 'Profile', icon: 'person', go: { kind: 'screen', screen: 'profile' } },
];

export function menuFor(current: Tab): (MenuItem & { current: boolean })[] {
  return MENU_ITEMS.map((m) => ({ ...m, current: m.go.kind === 'tab' && m.go.tab === current }));
}
