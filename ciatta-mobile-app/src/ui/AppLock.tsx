// Holds the app behind Face ID when she has turned it on: at every open,
// and after more than a minute away. Her record is never drawn behind the
// lock, so nothing shows in the app switcher either.

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { shouldLock } from '../lib/appLock';
import { checkFace, faceIdIsOn } from '../state/faceId';
import { font } from '../theme';
import { Ground } from './Ground';
import { Icon } from './icons';
import { PrimaryButton } from './kit';
import { G } from './scheme';
import { Wordmark } from './Wordmark';

export function AppLock({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking');
  const on = useRef(false);
  const away = useRef<number | null>(null);

  const unlock = async () => {
    if (await checkFace('Unlock Ciatta')) setState('open');
  };

  useEffect(() => {
    faceIdIsOn().then((v) => {
      on.current = v;
      if (shouldLock({ on: v, backgroundedAt: null, now: Date.now() })) {
        setState('locked');
        void unlock();
      } else setState('open');
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') away.current = Date.now();
      if (s === 'active') {
        // Read again: she may have just turned it on or off in Settings.
        faceIdIsOn().then((v) => {
          on.current = v;
          if (shouldLock({ on: v, backgroundedAt: away.current, now: Date.now(), unlocked: true })) {
            setState('locked');
            void unlock();
          }
          away.current = null;
        });
      }
    });
    return () => sub.remove();
  }, []);

  if (state === 'open') return <>{children}</>;
  return (
    <Ground>
      <View style={s.page}>
        <Wordmark />
        {state === 'locked' ? (
          <View style={s.body}>
            <Icon name="shield" size={36} color={G.ink} />
            <Text style={[font('title2', 'semibold'), s.title]}>Ciatta is locked</Text>
            <Text style={[font('subhead'), s.sub]}>Your record stays private until you unlock it.</Text>
            <View style={s.button}>
              <PrimaryButton label="Unlock with Face ID" onPress={() => void unlock()} />
            </View>
          </View>
        ) : null}
      </View>
    </Ground>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, paddingTop: 80, paddingHorizontal: 24, alignItems: 'center' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  title: { color: G.ink, marginTop: 8 },
  sub: { color: G.body, textAlign: 'center' },
  button: { marginTop: 20, alignSelf: 'stretch' },
});
