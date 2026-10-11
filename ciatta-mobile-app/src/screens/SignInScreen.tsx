import * as AppleAuthentication from 'expo-apple-authentication';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, BackHandler, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle, SocialAuthCancelled } from '../lib/socialAuth';
import { consentsFor } from '../lib/onboarding';
import { supabase } from '../lib/supabase';
import { userFacingError } from '../lib/userFacingError';
import { useSession } from '../state/session';
import { C, font, GUTTER, RADIUS } from '../theme';
import { images } from '../ui/images';
import { Ground } from '../ui/Ground';
import { L } from '../ui/surface';
import { Wordmark } from '../ui/Wordmark';

// The hero loops silently behind all three panes. It is decorative: nothing
// here is said by the video alone, so a reader that never sees it loses
// nothing.
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

// Which of the three panes is showing. Local state rather than three screens
// in the app's navigator, because the navigator only exists once she is signed
// in, and because one player shared across the panes keeps the footage running
// unbroken instead of restarting on every move.
type Pane = 'welcome' | 'signup' | 'login';

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

// Consent, recorded once per account and repaired if it was ever missed.
//
// Two things this must not do, both found in review.
//
// It must not key off which pane she tapped. Both panes call
// signInWithIdToken, which CREATES the user when none exists, so the login
// pane can mint an account and the sign up pane can be tapped by someone who
// already has one. Keying off the pane meant a new account via login got no
// consent row at all, and a returning woman tapping sign up got a fresh
// marketing_email row at granted false, because the checkbox resets on mount.
// That last one is worse than recording nothing: consents_user_kind reads the
// newest row per kind, so the table would have said she withdrew a consent
// she never touched.
//
// So it keys off the record instead. No terms row means this account has
// never consented, which is true exactly once per account however she got
// here. Running on every successful sign in is what makes it a repair: a
// write that failed on the network last time lands on the next launch.
async function ensureConsent(marketingEmail: boolean) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;

  const { data: existing, error: readError } = await supabase
    .from('consents')
    .select('id')
    .eq('kind', 'terms')
    .limit(1);
  // A failed read must not cause a second set of rows to be written on top of
  // a set that may already be there. Doing nothing leaves the repair for the
  // next sign in, which is the safe direction to fail in.
  if (readError) return;
  if (existing && existing.length > 0) return;

  const rows = consentsFor(marketingEmail).map((c) => ({
    user_id: user.id,
    kind: c.kind,
    granted: c.granted,
    policy_version: c.policyVersion,
  }));
  const { error } = await supabase.from('consents').insert(rows);
  if (error && __DEV__) {
    console.log('[consent] not recorded', JSON.stringify({ code: (error as { code?: string }).code }));
  }
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
  const [pane, setPane] = useState<Pane>('welcome');
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Starts true so the first frame is the still image rather than motion she
  // asked not to see. The check below lowers it only once it has answered.
  const [reduceMotion, setReduceMotion] = useState(true);
  // Off by default. A box already ticked is not consent she gave.
  const [marketingEmail, setMarketingEmail] = useState(false);

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

  // Android's back gesture returns to the welcome pane rather than leaving the
  // app, which is what a person expects from something that behaved like a
  // pushed screen on the way in.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pane === 'welcome') return false;
      setPane('welcome');
      return true;
    });
    return () => sub.remove();
  }, [pane]);

  // accessibilityLiveRegion below is Android only, so on iOS VoiceOver says
  // nothing at all when a sign in fails. Announce it here as well.
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(displayCopy(error));
  }, [error]);

  // Moving between panes clears a failure from the one before. Carrying it
  // across would show an error about an attempt she made on another screen.
  const go = (next: Pane) => () => {
    setError('');
    setPane(next);
  };

  const run = (signIn: () => Promise<{ fullName: string | null }>) => async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { fullName } = await signIn();
      // Run on both panes. Either can create an account, and ensureConsent
      // writes only when the account has no terms row, so this is both the
      // first record and the repair for one that failed earlier.
      await ensureConsent(marketingEmail);
      try {
        await keepFirstName(fullName);
      } catch {
        // Best effort: a failed name save should not read as a failed sign in.
      }
    } catch (e) {
      if (!(e instanceof SocialAuthCancelled)) {
        // Development only. userFacingError exists to keep backend and system
        // text off the screen, which is right, but it means a failure leaves
        // no trace anywhere and cannot be diagnosed. This logs the three
        // fields that say what went wrong and none of the ones that could
        // carry a credential: never the error object itself, which on a
        // rejected sign in can hold the identity token that was presented.
        if (__DEV__) {
          const d = e as { name?: string; code?: string | number; status?: number; message?: string };
          console.log(
            '[signin] failed',
            JSON.stringify({ name: d?.name, code: d?.code, status: d?.status, message: d?.message }),
          );
        }
        setError(userFacingError(e, 'That sign in did not go through. Try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  // The sign up and log in panes stand on white; only welcome keeps the film.
  // Whether the film is behind this pane. It was called `light` when the
  // two auth panes were white; they are on the ground with everything else
  // now, so the only thing it still decides is the film and the Apple
  // button that sits over it.
  const onFilm = pane === 'welcome';

  // The two auth cards, shared by the sign up and log in panes. Two things
  // differ between them: the Apple button's type, because Apple's guidelines
  // distinguish signing up from signing in and the label follows that choice,
  // and the treatment, because these cards now sit on white.
  //
  // On white the Apple button has to be BLACK. The WHITE style it uses over
  // the film would be a white card on a white page, which is not a quieter
  // button, it is an invisible one. Google turns solid dark to match it:
  // tinted glass only means anything over moving footage, and over a flat
  // white page it is just a pale grey box.
  const authCards = (signUp: boolean) => (
    <View style={s.buttons}>
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            signUp
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
          }
          // White on every pane: the ground is dark everywhere now, and
          // Apple's black button would disappear into it.
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={RADIUS}
          style={s.apple}
          onPress={run(signInWithApple)}
        />
      ) : null}
      <Pressable
        onPress={run(signInWithGoogle)}
        accessibilityRole="button"
        accessibilityLabel={signUp ? 'Sign up with Google' : 'Continue with Google'}
        style={({ pressed }) => [s.google, pressed && s.pressed]}
      >
        <GoogleMark />
        <Text style={[font('headline'), { color: C.text }]}>
          {signUp ? 'Sign up with Google' : 'Continue with Google'}
        </Text>
      </Pressable>
    </View>
  );

  const errorLine = error ? (
    // The peach reads at 2.2:1 on white, which is not legible at footnote
    // size, so the error carries a lifted red instead. A failure she
    // cannot read is a failure she will repeat.
    <Text
      style={[font('footnote'), s.error]}
      accessibilityLiveRegion="polite"
    >
      {displayCopy(error)}
    </Text>
  ) : null;

  const back = (
    <Pressable
      onPress={go('welcome')}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [s.back, pressed && s.pressed]}
    >
      <Text style={[font('body'), { color: C.text }]}>Back</Text>
    </Pressable>
  );

  // Back and the wordmark, carried by every pane.
  //
  // Back is positioned out of the flow rather than stacked above the mark.
  // In the flow it added its own 44pt plus a gap, which pushed the wordmark
  // that much lower on these two panes than on the welcome pane, and the mark
  // is supposed to land in the same place on all three.
  const header = (
    <View style={s.top}>
      {pane === 'welcome' ? null : <View style={s.backAbs}>{back}</View>}
      <View style={s.logoWrap}>
        {/*
          Type rather than artwork now, so there is nothing to tint: the
          mark takes Graphite on the white panes and Paper on the film,
          which are the only two grounds the Constitution allows it.
        */}
        {/* Paper on every pane now that all three are on the ground. */}
        <Wordmark color={L.recessed} />
      </View>
    </View>
  );

  return (
    <Ground>
      {/*
        The film pane paints its own ground, exactly as it did before the
        shared one existed: the video is what covers this screen, and the
        colour behind it is only what shows for the instant before the
        first frame. The two auth panes let the shared ground through.
      */}
      <View style={[s.fill, onFilm && s.fillFilm]}>
      {/*
        The film is the welcome pane's alone now. Rendering it behind white and
        covering it would keep a video decoding for a screen nobody can see it
        on, which costs battery for nothing.
      */}
      {onFilm ? (
        <View style={s.hero} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
          {reduceMotion ? (
            <Image source={images.horizon} style={s.heroMedia} resizeMode="cover" />
          ) : (
            <VideoView player={player} style={s.heroMedia} contentFit="cover" nativeControls={false} />
          )}
        </View>
      ) : null}

      <ScrollView style={s.scroll} contentContainerStyle={[s.body, { paddingTop: insets.top + 24 }]}>
        {pane === 'welcome' ? header : null}

        {pane === 'welcome' ? (
          <View style={s.pad}>
            {/*
              Two cards, one solid and one glass. White stays the way forward:
              on moving darkness a lone light card is hard to mistake for
              anything but the next step. Login is the same object in glass,
              which reads as available without competing with it.

              The glass is the recipe the Google card below already uses, and
              for the same reason: a real frosted pane needs expo-blur, a
              native module this dev client was not built with, so it is a
              white wash at low alpha with a brighter hairline edge, set where
              the white label clears contrast against the brightest frame in
              the clip rather than at the glassiest value.
            */}
            <Pressable
              onPress={go('signup')}
              accessibilityRole="button"
              accessibilityLabel="Get Started"
              style={({ pressed }) => [s.primaryCard, pressed && s.pressed]}
            >
              <Text style={[font('headline', 'bold'), { color: C.bg }]}>Get Started</Text>
            </Pressable>
            <Pressable
              onPress={go('login')}
              accessibilityRole="button"
              accessibilityLabel="Login"
              style={({ pressed }) => [s.glassCard, pressed && s.pressed]}
            >
              <Text style={[font('headline', 'bold'), { color: C.text }]}>Login</Text>
            </Pressable>
            <View style={s.inlineRow}>
              <Text style={[font('footnote'), { color: C.text }]}>Not ready?</Text>
              <Pressable
                onPress={enterDemo}
                accessibilityRole="button"
                style={({ pressed }) => [s.inlineHit, pressed && s.pressed]}
              >
                <Text style={[font('footnote'), { color: C.tint }]}>Look Around First</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/*
          Three separate children on these two panes, which is what puts the
          cards in the middle: space-between sends the first to the top, the
          last to the foot, and leaves the one between them centred in what is
          left. Grouped with the header, as they were, they sat at the top
          instead.
        */}
        {pane === 'signup' ? header : null}

        {pane === 'signup' ? (
          <View style={s.pad}>
            <Text style={[font('title1'), s.heading]} accessibilityRole="header">
              Let&rsquo;s get started
            </Text>
            {authCards(true)}
            {errorLine}
          </View>
        ) : null}

        {pane === 'signup' ? (
          <View style={s.pad}>
            {/*
              At the foot of the screen, which is where it belongs: this is the
              consent she gives by tapping the card above it, so it has to be
              visible at the moment she taps rather than somewhere she could
              reach only afterwards.
              The two links are inline rather than separate controls, because
              breaking the sentence into buttons would break the sentence.
            */}
            <Text style={[font('caption1'), s.terms]}>
              By signing up, you agree to Ciatta&rsquo;s{' '}
              <Text style={s.termsLink} onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
                Terms of Use
              </Text>
              , and you acknowledge that you have read our{' '}
              <Text style={s.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
                Privacy Policy
              </Text>
              .
            </Text>
            {/*
              Its own control, off by default. Marketing consent has to be
              separately given to be worth anything, and bundling it into the
              same tap as the terms makes it consent to nothing. Declining
              does not block sign up.
            */}
            <Pressable
              onPress={() => setMarketingEmail((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marketingEmail }}
              accessibilityLabel="Send me emails and updates"
              style={({ pressed }) => [s.consentRow, pressed && s.pressed]}
            >
              <View style={[s.checkbox, marketingEmail && s.checkboxOn]}>
                {marketingEmail ? <Text style={[font('caption1'), { color: C.text }]}>&#10003;</Text> : null}
              </View>
              <Text style={[font('caption1'), s.consentLabel]}>
                Send me emails and updates. Optional, and you can stop at any time.
              </Text>
            </Pressable>
          </View>
        ) : null}

        {pane === 'login' ? header : null}

        {pane === 'login' ? (
          <View style={s.pad}>
            <Text style={[font('title1'), s.heading]} accessibilityRole="header">
              Welcome back
            </Text>
            {authCards(false)}
            {errorLine}
          </View>
        ) : null}

        {pane === 'login' ? (
          <View style={s.pad}>
            {/*
              The same agreement as the sign up pane, because signing in with
              an Apple or Google identity that has no account here creates
              one. A path that can create an account has to show her what she
              is agreeing to, whichever button it is behind.
            */}
            <Text style={[font('caption1'), s.terms]}>
              By continuing you agree to Ciatta&rsquo;s{' '}
              <Text style={s.termsLink} onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
                Terms of Use
              </Text>
              , and you acknowledge that you have read our{' '}
              <Text style={s.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        ) : null}
      </ScrollView>
      </View>
    </Ground>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  fillFilm: { backgroundColor: C.bg },
  // The sign up and log in panes stand on white rather than on the film.
  // Behind everything and outside the ScrollView, so the footage stays put
  // while the content over it scrolls. Inside, it would slide away with the
  // buttons on a short screen and leave bare black at the bottom.
  hero: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Full opacity. At 0.5 over black, a full bleed video reads as grey haze
  // rather than footage, and the cards carry their own legibility.
  heroMedia: { width: '100%', height: '100%' },
  // Transparent, or it would paint C.bg straight over the video.
  scroll: { flex: 1, backgroundColor: 'transparent' },
  // space-between: the wordmark holds the top, the pane's content holds the
  // bottom, and the footage fills what is left.
  body: { paddingBottom: 48, flexGrow: 1, justifyContent: 'space-between' },
  // No gap any more: the wordmark is the only thing in the flow here, so this
  // block is exactly the mark's height on all three panes and the mark lands
  // at the same offset on each.
  top: {},
  // Centred on the mark rather than sitting on its top edge: the control is
  // 44pt tall against a 22pt mark, so it is lifted by half the difference.
  backAbs: { position: 'absolute', left: 0, top: -11, zIndex: 1 },
  back: { minHeight: 44, justifyContent: 'center', paddingHorizontal: GUTTER, alignSelf: 'flex-start' },
  logoWrap: { alignItems: 'center', paddingHorizontal: GUTTER },
  pad: { paddingHorizontal: GUTTER },
  // The one white card on the welcome pane. Same height and corner as the
  // Apple button the next screen opens with, so the step across feels like
  // the same object continuing rather than a different control.
  primaryCard: {
    height: 50,
    borderRadius: RADIUS,
    backgroundColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  // Same height, radius and padding as the card above it, so the pair reads
  // as two of one thing rather than a button and a link.
  glassCard: {
    height: 50,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 12,
  },
  buttons: { gap: 12, marginTop: 20 },
  apple: { height: 50 },
  // Tinted glass: a white wash at low alpha over the video, with a brighter
  // hairline edge, so the card picks up whatever is behind it.
  //
  // Tint without blur, and the distinction is worth being plain about: a true
  // frosted pane needs expo-blur, a native module this dev client was not
  // built with. The alpha is set where the white label clears contrast against
  // the brightest frame in the clip rather than at the glassiest value.
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
  // Solid on the white panes. The glass above is a wash of white at low alpha,
  // which over a white page is a pale grey rectangle rather than glass.
  pressed: { opacity: 0.55 },
  // Centred, on both auth panes.
  heading: { color: C.bg, textAlign: 'center' },
  error: { color: C.tint, marginTop: 12 },
  // 5.9:1 on white, where the peach manages 2.2:1.
  // Sentence then link on one line. flexWrap is the guard for the largest text
  // sizes, where the two would otherwise run past the gutter.
  // Centred under the card above them. flexWrap still guards the largest text
  // sizes, and with centre alignment a wrapped second line stays centred too
  // rather than hanging off the left edge.
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  inlineHit: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  // The two policy labels, centred, with a middle dot between them.
  legal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  // This paragraph only ever renders on the sign up pane, which is always
  // white now, so it is written for white outright rather than switched.
  // C.secondary was built for a dark card and manages 2.6:1 here; C.tertiary
  // reaches 8.4:1, and the links go to black so they sit above the sentence
  // they interrupt rather than disappearing into the page.
  terms: { color: C.tertiary, marginTop: 24, lineHeight: 17, textAlign: 'center' },
  termsLink: { color: C.bg, textDecorationLine: 'underline' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  consentLabel: { color: C.tertiary, flex: 1, lineHeight: 17 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: C.tint, borderColor: C.tint },
});
