import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, type } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';
import GhostButton from '../../components/GhostButton';
import KeyboardAvoidingScreen from '../../components/KeyboardAvoidingScreen';
import { connectHealthConnect } from '../../lib/healthConnect';
import { connectHealthKit } from '../../lib/healthKit';
import { displayCopy } from '../../lib/displayCopy';
import type { OnboardingDraft } from './OnboardingFlow';
import { signIn, signUp } from '../../lib/auth';
import { seedProfileName } from '../../lib/socialAuth';
import SocialAuthButtons from '../../components/SocialAuthButtons';
import { TextInput } from 'react-native';

const HEALTH_SOURCE_NAME = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';

export function emptyBetaDraft(connectHealthAfterAuth: boolean): OnboardingDraft {
  return {
    name: '',
    dob: '',
    lifeStage: null,
    story: null,
    notifPref: 'none',
    sharedHealthRows: [],
    pendingHealthNotes: {},
    height: '',
    weight: '',
    answers: [],
    needsCommit: false,
    connectHealthAfterAuth,
    connectCalendarAfterAuth: false,
    pendingDocuments: [],
    suggestedTests: [],
    includeMentalEmotional: false,
  };
}

type Step = 'welcome' | 'account' | 'why' | 'health';

export default function BetaCycle1({
  userId,
  onComplete,
}: {
  userId?: string;
  onComplete: (draft: OnboardingDraft) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(userId ? 'why' : 'welcome');
  const [healthConnecting, setHealthConnecting] = useState(false);
  const [healthNote, setHealthNote] = useState<string | null>(null);

  useEffect(() => {
    if (userId && (step === 'welcome' || step === 'account')) {
      setStep('why');
    }
  }, [userId, step]);

  async function connectThenFinish() {
    if (!userId) {
      onComplete(emptyBetaDraft(true));
      return;
    }
    setHealthConnecting(true);
    setHealthNote(null);
    try {
      if (Platform.OS === 'android') await connectHealthConnect(userId);
      else await connectHealthKit(userId);
      onComplete(emptyBetaDraft(false));
    } catch (e) {
      setHealthNote(
        e instanceof Error ? e.message : displayCopy('Health could not be connected just now.')
      );
    } finally {
      setHealthConnecting(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <KeyboardAvoidingScreen>
        {step === 'welcome' ? (
          <View style={styles.flex}>
            <Text style={styles.title}>{displayCopy('Ciatta')}</Text>
            <Text style={styles.body}>
              {displayCopy(
                'See what changed for you. Notice what keeps happening. Get context. When there is not enough, Ciatta stays quiet.'
              )}
            </Text>
            <View style={styles.flex} />
            <PrimaryButton label={displayCopy('Continue')} onPress={() => setStep('account')} />
          </View>
        ) : null}

        {step === 'account' ? (
          <AccountFields onAuthed={() => setStep('why')} />
        ) : null}

        {step === 'why' ? (
          <View style={styles.flex}>
            <Text style={styles.title}>{displayCopy('Ciatta compares you with you.')}</Text>
            <Text style={styles.body}>
              {displayCopy('It does not diagnose. It stays quiet without enough of your own history.')}
            </Text>
            <View style={styles.flex} />
            <PrimaryButton label={displayCopy('Continue')} onPress={() => setStep('health')} />
          </View>
        ) : null}

        {step === 'health' ? (
          <View style={styles.flex}>
            <Text style={styles.title}>
              {displayCopy(`Use ${HEALTH_SOURCE_NAME} for sleep?`)}
            </Text>
            <Text style={styles.body}>
              {displayCopy(
                'If you already have enough nights, Ciatta will not quiz you. Skip is fine.'
              )}
            </Text>
            {healthNote ? <Text style={styles.error}>{displayCopy(healthNote)}</Text> : null}
            <View style={styles.flex} />
            <PrimaryButton
              label={displayCopy(`Connect ${HEALTH_SOURCE_NAME}`)}
              onPress={connectThenFinish}
              loading={healthConnecting}
            />
            <GhostButton
              label={displayCopy('Skip')}
              onPress={() => onComplete(emptyBetaDraft(false))}
            />
          </View>
        ) : null}
      </KeyboardAvoidingScreen>
    </View>
  );
}

function AccountFields({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const result = await signUp(email.trim(), password);
        if (result.session) onAuthed();
        else setNeedsConfirmation(true);
      } else {
        await signIn(email.trim(), password);
        onAuthed();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : displayCopy('Something went wrong.'));
    } finally {
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <View style={styles.flex}>
        <Text style={styles.title}>{displayCopy('Check your email.')}</Text>
        <Text style={styles.body}>
          {displayCopy(`A confirmation link is on its way to ${email}. Once you have confirmed, come back here to continue.`)}
        </Text>
        {error ? <Text style={styles.error}>{displayCopy(error)}</Text> : null}
        <View style={styles.flex} />
        <PrimaryButton
          label={displayCopy("I've confirmed. Continue")}
          loading={loading}
          onPress={async () => {
            setLoading(true);
            try {
              await signIn(email.trim(), password);
              onAuthed();
            } catch (e) {
              setError(e instanceof Error ? e.message : displayCopy('Try again once you have confirmed.'));
            } finally {
              setLoading(false);
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>
        {mode === 'signup' ? displayCopy('Stay this person') : displayCopy('Welcome back.')}
      </Text>
      <Text style={styles.body}>
        {mode === 'signup'
          ? displayCopy('Your health stays with your account. Ciatta does not write observations until you continue.')
          : displayCopy('Sign in to pick up where you left off.')}
      </Text>
      <SocialAuthButtons
        onAuthed={(fullName) => {
          setError(null);
          if (fullName) seedProfileName(fullName).catch(() => {});
          onAuthed();
        }}
        onError={setError}
      />
      <Text style={styles.label}>{displayCopy('EMAIL')}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={colors.ink3}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Text style={styles.label}>{displayCopy('PASSWORD')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={displayCopy('At least 6 characters')}
        placeholderTextColor={colors.ink3}
        style={styles.input}
        secureTextEntry
        autoComplete="password"
      />
      {error ? <Text style={styles.error}>{displayCopy(error)}</Text> : null}
      <View style={styles.flex} />
      <PrimaryButton
        label={mode === 'signup' ? displayCopy('Create account') : displayCopy('Sign in')}
        onPress={handleSubmit}
        loading={loading}
        disabled={!email.trim() || password.length < 6}
      />
      <GhostButton
        label={
          mode === 'signup'
            ? displayCopy('Already have an account? Sign in')
            : displayCopy('New here? Create an account')
        }
        onPress={() => {
          setError(null);
          setMode((m) => (m === 'signup' ? 'signin' : 'signup'));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: 22,
  },
  flex: { flex: 1 },
  title: {
    ...type.title1,
    color: colors.ink,
    marginBottom: 12,
  },
  body: {
    ...fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink2,
  },
  label: {
    ...type.caption1,
    color: colors.ink3,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    ...fonts.sans,
    fontSize: 16,
    color: colors.ink,
  },
  error: {
    ...type.footnote,
    color: colors.accent,
    marginTop: 12,
  },
});
