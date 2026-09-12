// Per-weight imports: the package roots would bundle every weight they ship.
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
import { Urbanist_400Regular } from '@expo-google-fonts/urbanist/400Regular';
import { Urbanist_400Regular_Italic } from '@expo-google-fonts/urbanist/400Regular_Italic';
import { Urbanist_500Medium } from '@expo-google-fonts/urbanist/500Medium';
import { Urbanist_600SemiBold } from '@expo-google-fonts/urbanist/600SemiBold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Root } from './src/Root';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded, error] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Urbanist_400Regular,
    Urbanist_400Regular_Italic,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // A font failure falls back to system fonts rather than holding the splash.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}
