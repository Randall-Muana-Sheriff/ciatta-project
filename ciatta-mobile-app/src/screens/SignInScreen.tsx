import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle, SocialAuthCancelled } from '../lib/socialAuth';
import { supabase } from '../lib/supabase';
import { userFacingError } from '../lib/userFacingError';
import { useSession } from '../state/session';
import { C, font, GUTTER, RADIUS } from '../theme';
import { TextButton } from '../ui/chrome';
import { images } from '../ui/images';
import { SecondaryButton } from '../ui/kit';

// Apple only gives a name the first time, so it is kept straight away, and
// never over a name she already has.
async function keepFirstName(fullName: string | null) {
  const first = fullName?.trim().split(' ')[0];
  const { data } = await supabase.auth.getUser();
  if (!first || !data.user) return;
  await supabase.from('profiles').update({ first_name: first }).eq('id', data.user.id).is('first_name', null);
}

export function SignInScreen() {
  const { enterDemo } = useSession();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    isAppleSignInAvailable().then(setApple);
  }, []);

  const run = (signIn: () => Promise<{ fullName: string | null }>) => async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { fullName } = await signIn();
      await keepFirstName(fullName);
    } catch (e) {
      if (!(e instanceof SocialAuthCancelled)) setError(userFacingError(e, 'That sign in did not go through. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.body}>
      <View style={s.hero} pointerEvents="none">
        <Image source={images.horizon} style={s.heroImg} resizeMode="cover" />
      </View>
      <View style={s.pad}>
        <Text style={[font('title1'), { color: C.text }]} accessibilityRole="header">
          Keep what you log
        </Text>
        <Text style={[font('body'), s.lede]}>
          Sign in so your cycles, notes and sources are saved to a record only you can see, and carried forward each time you come back.
        </Text>
        <View style={s.buttons}>
          {apple ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={RADIUS}
              style={s.apple}
              onPress={run(signInWithApple)}
            />
          ) : null}
          <SecondaryButton label="Continue with Google" onPress={run(signInWithGoogle)} />
        </View>
        {error ? (
          <Text style={[font('footnote'), s.error]} accessibilityLiveRegion="polite">
            {displayCopy(error)}
          </Text>
        ) : null}
        <View style={s.demo}>
          <Text style={[font('footnote'), { color: C.secondary }]}>Not ready? See how it works with an example person. Nothing you do there is saved.</Text>
          <TextButton label="Look Around First" onPress={enterDemo} />
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  body: { paddingBottom: 48, flexGrow: 1, justifyContent: 'flex-end' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  heroImg: { width: '100%', height: '100%', opacity: 0.5 },
  pad: { paddingHorizontal: GUTTER, paddingTop: 280 },
  lede: { color: C.secondary, marginTop: 10, lineHeight: 25 },
  buttons: { gap: 12, marginTop: 28 },
  apple: { height: 50 },
  error: { color: C.tint, marginTop: 12 },
  demo: { marginTop: 32, gap: 6, alignItems: 'flex-start' },
});
