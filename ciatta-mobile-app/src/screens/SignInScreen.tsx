import * as AppleAuthentication from 'expo-apple-authentication';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle, SocialAuthCancelled } from '../lib/socialAuth';
import { supabase } from '../lib/supabase';
import { userFacingError } from '../lib/userFacingError';
import { useSession } from '../state/session';
import { C, font, GUTTER, RADIUS } from '../theme';
import { images } from '../ui/images';

// The hero loops silently behind the sign in. It is decorative: nothing here
// is said by the video alone, so a reader that never sees it loses nothing.
//
// 1080x2048 and 2.4MB, re encoded from a 55MB 2160x4096 master. The master is
// four times the pixels this screen can show on the densest phone, and every
// one of those megabytes would ship to every person who installs the app.
const HERO_VIDEO = require('../../assets/signin-hero.mp4');

// The published pages on the marketing site, so one wording is maintained in
// one place and she reads the same terms she would read before installing.
// Both answer 200; neither is a file bundled here that could drift from what
// the site says.
const PRIVACY_URL = 'https://ciatta.io/privacy/';
const TERMS_URL = 'https://ciatta.io/terms/';

// Google's G, drawn rather than shipped as a bitmap so it stays sharp at any
// density and needs no asset.
//
// The four colours are Google's own and are not ours to restyle: their sign in
// branding requires the mark in full colour, unaltered, which is also why it
// keeps its colour on a dark card instead of being tinted to match the label.
// The paths are the official 48x48 mark.
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

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
  const insets = useSafeAreaInsets();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Starts true so the first frame is the still image rather than motion she
  // asked not to see. The check below lowers it only once it has answered.
  const [reduceMotion, setReduceMotion] = useState(true);

  const player = useVideoPlayer(HERO_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    isAppleSignInAvailable().then(setApple);
  }, []);

  // Reduce Motion is a system setting a person turns on because movement makes
  // them unwell. A looping background is exactly the kind of motion it means,
  // so the video does not start at all when it is on, and the still hero the
  // screen already had is shown instead.
  useEffect(() => {
    let ignore = false;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (!ignore) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      ignore = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) player.pause();
    else player.play();
  }, [reduceMotion, player]);

  // accessibilityLiveRegion below is Android only, so on iOS VoiceOver says
  // nothing at all when a sign in fails. Announce it here as well.
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(displayCopy(error));
  }, [error]);

  const run = (signIn: () => Promise<{ fullName: string | null }>) => async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { fullName } = await signIn();
      try {
        await keepFirstName(fullName);
      } catch {
        // Best effort: a failed name save should not read as a failed sign in.
      }
    } catch (e) {
      if (!(e instanceof SocialAuthCancelled)) setError(userFacingError(e, 'That sign in did not go through. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.fill}>
      <View style={s.hero} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
        {reduceMotion ? (
          <Image source={images.horizon} style={s.heroMedia} resizeMode="cover" />
        ) : (
          <VideoView player={player} style={s.heroMedia} contentFit="cover" nativeControls={false} />
        )}
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={[s.body, { paddingTop: insets.top + 24 }]}>
        <View style={s.logoWrap}>
          <Image
            source={images.wordmark}
            style={s.logo}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Ciatta"
          />
        </View>
        <View style={s.pad}>
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
          {/*
            Built here rather than reusing SecondaryButton, which carries the
            peach label and no room for a mark. The height and the corner match
            the Apple button beside it, so the two read as a pair even though
            one is light and the other dark.
          */}
          <Pressable
            onPress={run(signInWithGoogle)}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={({ pressed }) => [s.google, pressed && s.pressed]}
          >
            <GoogleMark />
            <Text style={[font('headline'), { color: C.text }]}>Continue with Google</Text>
          </Pressable>
        </View>
        {error ? (
          <Text style={[font('footnote'), s.error]} accessibilityLiveRegion="polite">
            {displayCopy(error)}
          </Text>
        ) : null}
        {/*
          Directly under the cards, because this is the moment she is deciding
          whether to hand over an account, and terms she can only find after
          signing in are terms she agreed to without reading.
          Each one is its own control with its own 44pt touch target rather
          than tappable words inside a sentence, which is the size a finger
          actually needs.
        */}
        <View style={s.legal}>
          <Pressable
            onPress={() => Linking.openURL(PRIVACY_URL)}
            accessibilityRole="link"
            accessibilityHint="Opens the privacy policy on the Ciatta website"
            style={({ pressed }) => [s.legalHit, pressed && s.pressed]}
          >
            <Text style={[font('footnote'), { color: C.text }]}>Privacy Policy</Text>
          </Pressable>
          <Text style={[font('footnote'), { color: C.secondary }]}>·</Text>
          <Pressable
            onPress={() => Linking.openURL(TERMS_URL)}
            accessibilityRole="link"
            accessibilityHint="Opens the terms of use on the Ciatta website"
            style={({ pressed }) => [s.legalHit, pressed && s.pressed]}
          >
            <Text style={[font('footnote'), { color: C.text }]}>Terms of Use</Text>
          </Pressable>
        </View>
        <View style={s.demo}>
          {/*
            White rather than the grey this used to be. Grey on a dark card is
            comfortable; grey over moving footage is not, because the contrast
            changes with the frame underneath and the scrim that used to hold
            it up is gone.
          */}
          <Text style={[font('footnote'), { color: C.text }]}>Not ready? See how it works.</Text>
          {/*
            Rendered here rather than through the shared TextButton, which
            ProfileScreen also uses twice: changing its size there would shrink
            View Trends and Edit on a screen nobody asked me to touch.
            The 44pt box is kept even though the label inside it is smaller,
            because the target a finger needs does not shrink with the type.
          */}
          <Pressable
            onPress={enterDemo}
            accessibilityRole="button"
            style={({ pressed }) => [s.demoHit, pressed && s.pressed]}
          >
            <Text style={[font('footnote'), { color: C.tint }]}>Look Around First</Text>
          </Pressable>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  // Behind everything and outside the ScrollView, so the footage stays put
  // while the content over it scrolls. Inside, it would slide away with the
  // buttons on a short screen and leave bare black at the bottom.
  hero: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Full opacity now. At 0.5 over black, a full bleed video reads as grey
  // haze rather than footage; the gradient above carries legibility instead,
  // which keeps the picture intact where nothing sits on top of it.
  heroMedia: { width: '100%', height: '100%' },
  // Transparent, or it would paint C.bg straight over the video.
  scroll: { flex: 1, backgroundColor: 'transparent' },
  // space-between, not flex-end: there are two blocks now, and the wordmark
  // belongs at the top of the screen while the cards stay at the bottom.
  // flex-end would stack them together above the fold's lower edge.
  body: { paddingBottom: 48, flexGrow: 1, justifyContent: 'space-between' },
  // No vertical padding of its own any more: space-between on the body sets
  // the gap between the wordmark and the cards, and a paddingTop here would
  // fight it on a short screen by forcing the block taller than it needs.
  pad: { paddingHorizontal: GUTTER },
  buttons: { gap: 12, marginTop: 28 },
  apple: { height: 50 },
  // The same 50 and the same RADIUS as the Apple button above, so the pair
  // lines up exactly. Solid rather than translucent: with the scrim gone the
  // card itself is the only thing holding the label off the video.
  // Tinted glass: a white wash at low alpha over the video, with a brighter
  // hairline edge. Over moving footage the card picks up whatever is behind
  // it and shifts with the frame, which is the quality the solid C.fill it
  // replaced could not have.
  //
  // Tint without blur, and the distinction is worth being plain about: a true
  // frosted pane needs expo-blur, which is a native module this dev client was
  // not built with. The alpha is set where the white label clears contrast
  // against the brightest frame in the clip rather than at the glassiest value.
  google: {
    height: 50,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  pressed: { opacity: 0.55 },
  logoWrap: { alignItems: 'center', paddingHorizontal: GUTTER },
  // The wordmark is 3575x1046, so height follows width at its own ratio and
  // resizeMode contain keeps it from being stretched to fit a box.
  logo: { width: 74, height: 22 },
  // 20 to 8, for the same reason: the cards sit directly above this, so the
  // gap closing here moves them down too.
  legal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  legalHit: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  demoHit: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, alignSelf: 'flex-start' },
  error: { color: C.tint, marginTop: 12 },
  // One row now, sentence then link. Shorter than the stacked version it
  // replaces even with the 44pt target kept: that was 18 plus a 6 gap plus 44,
  // and this is 44. flexWrap is the guard for the largest text sizes, where
  // the two would otherwise run past the gutter rather than dropping the link
  // onto a second line.
  // marginTop down from 32 to 10. The block is anchored at the bottom, so
  // shrinking the last gap in it pulls everything above down rather than
  // moving this line up: the cards and the legal links close on the sentence,
  // which is the direction asked for.
  demo: { marginTop: 10, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
