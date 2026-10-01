import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CycleProfile } from '../lib/cycleProfile';
import { displayCopy } from '../lib/displayCopy';
import { isLast, nextStep, type OnboardingStep, STEPS, stepsFor } from '../lib/onboarding';
import { userFacingError } from '../lib/userFacingError';
import { useConnectAppleHealth } from '../state/connectAppleHealth';
import { useCycle } from '../state/cycleStore';
import { useSession } from '../state/session';
import { C, font, GUTTER, RADIUS } from '../theme';
import { CycleProfileForm } from '../ui/CycleProfileForm';
import { StepProgress } from '../ui/cycleInputs';
import { LinkButton, PrimaryButton } from '../ui/kit';

// The first steps after sign in: what the record is, a source, her cycle,
// her name, what to expect. Which steps and in what order is the rule in
// src/lib/onboarding.ts; this renders it. Every step has a way past it,
// and nothing she skips is stored as anything.
export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { firstName, finishOnboarding, setFirstName } = useSession();
  const { profile, setProfile } = useCycle();
  const plan = stepsFor(Platform.OS);
  const [step, setStep] = useState<OnboardingStep>(STEPS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CycleProfile>(profile);
  const [name, setName] = useState(firstName ?? '');
  const source = useConnectAppleHealth();

  const index = STEPS.indexOf(step);
  const available = plan.find((p) => p.step === step)?.available ?? true;

  const advance = () => {
    setError(null);
    const next = nextStep(step);
    if (next) setStep(next);
    else void finishOnboarding();
  };
  const finish = () => {
    setError(null);
    void finishOnboarding();
  };

  const saveCycle = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProfile({ ...draft, setupDone: true }, (e) => {
      setBusy(false);
      if (e) setError(userFacingError(e, 'That did not save. Try again.'));
      else advance();
    });
  };

  const saveName = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === firstName) {
      advance();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setFirstName(trimmed);
      advance();
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.fill} contentContainerStyle={[s.body, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      <StepProgress index={index} total={STEPS.length} />

      {step === 'welcome' ? (
        <View>
          <Text style={[font('title1'), s.title]} accessibilityRole="header">
            Your own record
          </Text>
          <Text style={[font('body'), s.para]}>What you log and what your devices measure stay in one record that only you can see.</Text>
          <Text style={[font('body'), s.para]}>
            When something in it changes in a sustained way, Today shows it beside the evidence it rests on.
          </Text>
          <Text style={[font('body'), s.para]}>
            It never names a cause and never gives a diagnosis. It shows what happened near what, and leaves the reading to you and the people who care for you.
          </Text>
          <View style={s.actions}>
            <PrimaryButton label="Continue" onPress={advance} />
            <LinkButton label="Skip for now" onPress={finish} center />
          </View>
        </View>
      ) : null}

      {step === 'source' ? (
        <View>
          <Text style={[font('title1'), s.title]} accessibilityRole="header">
            Connect a source
          </Text>
          {available ? (
            <>
              <Text style={[font('body'), s.para]}>
                Steps, sleep and heart measures from your phone and watch give the record something to work with from the first day.
              </Text>
              <Text style={[font('body'), s.para]}>You choose what it may read, and you can turn it off at any time in Settings.</Text>
              {source.note ? <Text style={[font('footnote'), s.note]}>{displayCopy(source.note)}</Text> : null}
              <View style={s.actions}>
                {source.status === 'active' ? (
                  <PrimaryButton label="Continue" onPress={advance} />
                ) : (
                  <PrimaryButton label="Connect Apple Health" onPress={() => void source.connect()} disabled={source.connecting} />
                )}
                <LinkButton label={source.status === 'active' ? 'Back' : 'Not now'} onPress={source.status === 'active' ? () => setStep('welcome') : advance} center />
              </View>
            </>
          ) : (
            <>
              <Text style={[font('body'), s.para]}>On this phone, device data comes in a later version. Everything you log is kept, and comparisons start from what you log.</Text>
              <View style={s.actions}>
                <PrimaryButton label="Continue" onPress={advance} />
              </View>
            </>
          )}
        </View>
      ) : null}

      {step === 'cycle' ? (
        <View>
          <Text style={[font('title1'), s.title]} accessibilityRole="header">
            Your cycle
          </Text>
          <CycleProfileForm draft={draft} setDraft={setDraft} />
          {error ? <Text style={[font('footnote'), s.error]}>{displayCopy(error)}</Text> : null}
          <View style={s.actions}>
            <PrimaryButton label="Save and continue" onPress={saveCycle} disabled={busy} />
            <LinkButton label="Skip for now" onPress={advance} center />
          </View>
        </View>
      ) : null}

      {step === 'name' ? (
        <View>
          <Text style={[font('title1'), s.title]} accessibilityRole="header">
            Your name
          </Text>
          <Text style={[font('body'), s.para]}>How should Today greet you?</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your first name"
            placeholderTextColor={C.muted}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel="Your first name"
            style={[font('body'), s.input]}
          />
          {error ? <Text style={[font('footnote'), s.error]}>{displayCopy(error)}</Text> : null}
          <View style={s.actions}>
            <PrimaryButton label="Continue" onPress={() => void saveName()} disabled={busy} />
            <LinkButton label="Skip for now" onPress={advance} center />
          </View>
        </View>
      ) : null}

      {step === 'expect' ? (
        <View>
          <Text style={[font('title1'), s.title]} accessibilityRole="header">
            What to expect
          </Text>
          <Text style={[font('body'), s.para]}>
            Today starts with what you log. Comparisons begin once a measure has a few weeks of history behind it.
          </Text>
          <Text style={[font('body'), s.para]}>Log how things are from Today, and connect sources from Profile.</Text>
          <Text style={[font('body'), s.para]}>These first steps stay in Profile, under Settings, if you want them again.</Text>
          <View style={s.actions}>
            <PrimaryButton label={isLast(step) ? 'Start' : 'Continue'} onPress={finish} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  body: { paddingHorizontal: GUTTER, flexGrow: 1 },
  title: { color: C.text, marginTop: 24, marginBottom: 12 },
  para: { color: C.secondary, lineHeight: 25, marginBottom: 12 },
  note: { color: C.secondary, marginTop: 4, marginBottom: 8 },
  error: { color: C.tint, marginTop: 8 },
  input: {
    color: C.text,
    backgroundColor: C.card,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  actions: { gap: 12, marginTop: 28 },
});
