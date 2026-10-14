// Resolves light or dark before anything else loads.
//
// Every StyleSheet in the app captures its colours when its module is first
// evaluated, so the palette has to be in place before App and the screens
// are required. Boot imports only the tokens, writes the chosen palette into
// them, then requires App. A change of scheme, or of the phone's own
// appearance while on System, reloads the app.

import * as SplashScreen from 'expo-splash-screen';
import { type ComponentType, useEffect, useState } from 'react';
import { Appearance, AppState } from 'react-native';

import { loadScheme, reloadApp, setLoadedScheme } from './src/state/colorScheme';
import { GLASS } from './src/ui/glass';
import { applyMode, G, resolveMode, type Scheme } from './src/ui/scheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Boot() {
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    let scheme: Scheme = 'system';
    loadScheme()
      .then(async (s) => {
        scheme = s;
        setLoadedScheme(s);
        // Clear any override left by the last run, so System reads the
        // phone itself; the native side settles a frame later.
        Appearance.setColorScheme('unspecified');
        await new Promise((r) => setTimeout(r, 60));
        const mode = resolveMode(s, Appearance.getColorScheme());
        applyMode(mode, GLASS);
        // iOS draws its own pieces (keyboards, menus, the HealthKit sheet)
        // in the app's style, so a fixed choice is passed on to them.
        if (s !== 'system') Appearance.setColorScheme(mode);
        return s;
      })
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        setApp(() => require('./App').default as ComponentType);
      });
    // iOS reports both appearances while it snapshots the app going to the
    // background, so the phone's setting is only read on coming back.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || scheme !== 'system') return;
      if (resolveMode('system', Appearance.getColorScheme()) !== G.mode) reloadApp().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  return App ? <App /> : null;
}
