// Per-weight imports: the package root would bundle every weight it ships.
import { Jost_400Regular } from '@expo-google-fonts/jost/400Regular';
import { Jost_400Regular_Italic } from '@expo-google-fonts/jost/400Regular_Italic';
import { Jost_500Medium } from '@expo-google-fonts/jost/500Medium';
import { Jost_600SemiBold } from '@expo-google-fonts/jost/600SemiBold';
import { Jost_700Bold } from '@expo-google-fonts/jost/700Bold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Root } from './src/Root';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { CycleStoreProvider } from './src/state/cycleStore';
import { SessionProvider, useSession } from './src/state/session';
import { C } from './src/theme';

// Signed out sees sign in; the example person and her own record each get a
// fresh store, so nothing carries from one into the other. Her own record
// opens on the first steps until she has been through them (or skipped
// them); while that is still being read, the app shows itself rather than
// a blank screen, so a slow read never holds her record back.
function Gate() {
  const { mode, userId, onboarded } = useSession();
  if (mode === 'loading') return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (mode === 'signedOut') return <SignInScreen />;
  return (
    <CycleStoreProvider key={`${mode}:${userId ?? ''}`}>
      {mode === 'real' && onboarded === false ? <OnboardingScreen /> : <Root />}
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
