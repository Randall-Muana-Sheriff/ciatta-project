// Per-weight imports: the package root would bundle every weight it ships.
import { Jost_400Regular } from '@expo-google-fonts/jost/400Regular';
import { Jost_400Regular_Italic } from '@expo-google-fonts/jost/400Regular_Italic';
import { Jost_500Medium } from '@expo-google-fonts/jost/500Medium';
import { Jost_600SemiBold } from '@expo-google-fonts/jost/600SemiBold';
import { Jost_700Bold } from '@expo-google-fonts/jost/700Bold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Root } from './src/Root';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { CycleStoreProvider } from './src/state/cycleStore';
import { SessionProvider, useSession } from './src/state/session';
import { C } from './src/theme';

// Signed out sees sign in; the example person and her own record each get a
// fresh store, so nothing carries from one into the other.
//
// A real session also passes through the first session once. onboarded_at is
// the gate: null means she has not finished, which includes someone who began
// onboarding and closed the app, so an interrupted first session resumes
// rather than being skipped.
function Gate() {
  const { mode, userId, repo } = useSession();
  // null while the answer is unknown, which is a third state rather than a
  // default: rendering Root on "not yet known" would flash her own empty
  // record at her before onboarding, and rendering onboarding would show it
  // to someone who finished it months ago.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (mode !== 'real' || !repo) {
      setOnboarded(null);
      return;
    }
    let ignore = false;
    setOnboarded(null);
    repo
      .loadOnboardedAt()
      .then((at) => {
        if (!ignore) setOnboarded(at !== null);
      })
      .catch(() => {
        // Fails open. A network error on this one read must not trap her
        // outside her own record, and the worst case is that she is offered
        // the first session again on the next launch.
        if (!ignore) setOnboarded(true);
      });
    return () => {
      ignore = true;
    };
  }, [mode, repo, userId]);

  if (mode === 'loading') return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (mode === 'signedOut') return <SignInScreen />;
  if (mode === 'real' && onboarded === null) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (mode === 'real' && onboarded === false) return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  return (
    <CycleStoreProvider key={`${mode}:${userId ?? ''}`}>
      <Root />
    </CycleStoreProvider>
  );
}

export default function App() {
  const [loaded, error] = useFonts({
    Jost_400Regular,
    Jost_400Regular_Italic,
    Jost_500Medium,
    Jost_600SemiBold,
    Jost_700Bold,
  });

  // The native splash doesn't dismiss itself in this build, so hide it once
  // the fonts are ready.
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // A font failure falls back to system fonts rather than holding the splash.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
