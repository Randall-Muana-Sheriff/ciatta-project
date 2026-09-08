import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';

import { colors, fonts as fontTokens, type } from './src/theme/tokens';
import GlassSurface from './src/components/GlassSurface';
import { supabase } from './src/lib/supabase';
import { signOut, getSession } from './src/lib/auth';
import { isAuthFailure } from './src/lib/errors';
import { isClockSkewError, logSessionClockSkew, withClockSkewRetry } from './src/lib/sessionGuard';
import { fetchProfile, updateProfile } from './src/lib/profile';
import {
  countSleepSessions,
  fetchLatestUserNowNote,
  fetchRelationships,
  fetchUnderstandings,
  hasHealthSourceObservations,
  type RelationshipRow,
  type UnderstandingRow,
} from './src/lib/queries';
import { answerCuriosity, fetchNextOnboardingQuestion } from './src/lib/curiosity';
import {
  fetchLastHealthSyncAt,
  fetchRecentSyncSummary,
  insertObservation,
  type RecentSyncSummary,
} from './src/lib/observations';
import { registerForPush } from './src/lib/notifications';
import { connectHealthConnect } from './src/lib/healthConnect';
import { connectHealthKit, startHealthKitObservers, stopHealthKitObservers } from './src/lib/healthKit';
import { syncCalendarContext } from './src/lib/calendarContext';
import { saveHealthNote } from './src/lib/healthNotes';
import { displayCopy } from './src/lib/displayCopy';
import { composeNow } from './src/lib/nowComposition';
import { isEligibleCareConnection } from './src/lib/careConnection';
import { formatSleepMinutes } from './src/lib/observations';
import type { Profile } from './src/lib/types';

import { completeOnboardingAfterAuth } from './src/lib/onboardingComplete';
import { clearGuestOnboardingDraft } from './src/lib/onboardingDraft';
import type { OnboardingDraft } from './src/screens/onboarding/OnboardingFlow';
import BetaCycle1 from './src/screens/onboarding/BetaCycle1';
import NowScreen from './src/screens/NowScreen';
import AccountScreen from './src/screens/AccountScreen';
import BottomNav, { MainTab } from './src/components/BottomNav';
import { NavAdaptivityProvider } from './src/lib/NavAdaptivity';

import ProviderSearchSheet from './src/overlays/ProviderSearchSheet';
import DataPrivacySheet from './src/overlays/DataPrivacySheet';
import HealthSyncSheet from './src/overlays/HealthSyncSheet';
import AddObservationSheet from './src/overlays/AddObservationSheet';
import PrimaryButton from './src/components/PrimaryButton';
import AnimatedSplash from './src/components/AnimatedSplash';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AUTO_SYNC_COOLDOWN_MS = 60 * 60 * 1000;

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [understandings, setUnderstandings] = useState<UnderstandingRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [healthSourceConnected, setHealthSourceConnected] = useState(false);
  const [recentSyncSummary, setRecentSyncSummary] = useState<RecentSyncSummary | null>(null);
  const [sleepNightCount, setSleepNightCount] = useState(0);
  const [userNowNote, setUserNowNote] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const holdingOnboardingRef = useRef(false);

  const [tab, setTab] = useState<MainTab>('now');
  const [dataPrivacyVisible, setDataPrivacyVisible] = useState(false);
  const [healthSyncVisible, setHealthSyncVisible] = useState(false);
  const [careSearchVisible, setCareSearchVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      logSessionClockSkew(data.session?.access_token, 'getSession (restart/persisted)');
      setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      logSessionClockSkew(s?.access_token, `onAuthStateChange (${event})`);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const autoSyncInFlightRef = useRef(false);
  const maybeAutoSync = useCallback(async (userId: string) => {
    if (autoSyncInFlightRef.current) return;
    autoSyncInFlightRef.current = true;
    try {
      const lastSyncedAt = await fetchLastHealthSyncAt(userId);
      const due =
        !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > AUTO_SYNC_COOLDOWN_MS;
      if (!due) return;
      const result =
        Platform.OS === 'android' ? await connectHealthConnect(userId) : await connectHealthKit(userId, { reason: 'background' });
      if (result.granted) {
        setRecentSyncSummary(await fetchRecentSyncSummary(userId));
        setSleepNightCount(await countSleepSessions(userId));
        setHealthSourceConnected(await hasHealthSourceObservations(userId));
      }
    } catch {
      // Silent by design.
    } finally {
      autoSyncInFlightRef.current = false;
    }
  }, []);

  const loadUserData = useCallback(
    async (userId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setDataLoading(true);
        setLoadError(null);
      }
      try {
        const [p, u, r, hc, sync, nights, note] = await withClockSkewRetry(
          () =>
            Promise.all([
              fetchProfile(userId),
              fetchUnderstandings(userId),
              fetchRelationships(userId),
              hasHealthSourceObservations(userId),
              fetchRecentSyncSummary(userId),
              countSleepSessions(userId),
              fetchLatestUserNowNote(userId),
            ]),
          'loadUserData'
        );
        setProfile(p);
        setUnderstandings(u);
        setRelationships(r);
        setHealthSourceConnected(hc);
        setRecentSyncSummary(sync);
        setSleepNightCount(nights);
        setUserNowNote(note);
        registerForPush(userId, p?.notification_preference);
        if (hc) {
          maybeAutoSync(userId);
        }
      } catch (e) {
        if (isAuthFailure(e)) {
          console.error('Session is no longer valid, signing out:', e);
          try {
            await signOut();
          } catch (signOutError) {
            console.error('Sign out during recovery also failed:', signOutError);
          }
        } else {
          if (isClockSkewError(e)) {
            console.error(
              'PGRST303 (JWT issued at future) persisted through refresh + retry, treating as transient, not signing out:',
              e
            );
          } else {
            console.error('Could not load user data (keeping session):', e);
          }
          setLoadError(
            "Your data couldn't be reached just now. Check your connection and try again."
          );
        }
      } finally {
        if (!opts?.silent) setDataLoading(false);
      }
    },
    [maybeAutoSync]
  );

  useEffect(() => {
    if (session?.user?.id) {
      loadUserData(session.user.id);
    } else {
      stopHealthKitObservers();
      setProfile(null);
      setUnderstandings([]);
      setRelationships([]);
      setHealthSourceConnected(false);
      setRecentSyncSummary(null);
      setSleepNightCount(0);
      setUserNowNote(null);
      setReceipt(null);
    }
  }, [session?.user?.id, loadUserData]);

  useEffect(() => {
    if (Platform.OS === 'ios' && session?.user?.id && healthSourceConnected) {
      startHealthKitObservers(session.user.id);
    }
  }, [session?.user?.id, healthSourceConnected]);

  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const cameToForeground =
        /inactive|background/.test(appStateRef.current) && nextState === 'active';
      appStateRef.current = nextState;
      if (cameToForeground && session?.user?.id) {
        console.log('[hksync] Now reload on foreground');
        loadUserData(session.user.id, { silent: true });
      }
    });
    return () => sub.remove();
  }, [session?.user?.id, loadUserData]);

  async function handleOnboardingComplete(draft: OnboardingDraft) {
    const sessionNow = (await getSession()) ?? session;
    const userId = sessionNow?.user?.id;
    if (!userId) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await completeOnboardingAfterAuth(userId, draft, {
        fetchProfile,
        updateProfile,
        fetchNext: fetchNextOnboardingQuestion,
        answer: answerCuriosity,
        syncHealth: async (id) => {
          try {
            if (Platform.OS === 'android') await connectHealthConnect(id);
            else if (Platform.OS === 'ios') await connectHealthKit(id);
          } catch (healthError) {
            console.error('Health source sync after onboarding failed:', healthError);
          }
        },
        syncCalendar: async (id) => {
          try {
            await syncCalendarContext(id);
          } catch (calendarError) {
            console.error('Calendar context after onboarding failed:', calendarError);
          }
        },
        saveHealthNotes: async (id, notes) => {
          for (const [category, text] of Object.entries(notes)) {
            if (text.trim()) await saveHealthNote(id, category, text);
          }
        },
        clearGuestDraft: clearGuestOnboardingDraft,
        loadUserData,
      });
      if (result.status === 'entered-existing-account' || result.status === 'onboarded') {
        setProfile(result.profile as Profile);
      }
    } catch (e) {
      setCompleteError(
        e instanceof Error ? e.message : 'Something went wrong saving your profile.'
      );
    } finally {
      setCompleting(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  }

  async function handleSaveObservation(text: string) {
    const userId = session?.user?.id;
    if (!userId) return;
    setAddSaving(true);
    setAddError(null);
    try {
      await insertObservation(userId, {
        source: 'manual',
        type: 'health_concern_detail',
        value: { text },
        context: { origin: 'now_add' },
      });
      setAddVisible(false);
      setReceipt(displayCopy('Saved as what you added. Ciatta will look again with this included.'));
      await loadUserData(userId);
    } catch (e) {
      setAddError(
        e instanceof Error ? e.message : displayCopy('This could not be saved just now.')
      );
    } finally {
      setAddSaving(false);
    }
  }

  if (!splashDone) {
    return (
      <SafeAreaProvider>
        <AnimatedSplash
          ready={session !== undefined}
          onFinish={() => setSplashDone(true)}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  if (session && profile && profile.onboarded_at) {
    holdingOnboardingRef.current = false;
  } else {
    if (!session) {
      holdingOnboardingRef.current = true;
    }

    if (session && !holdingOnboardingRef.current) {
      if (!dataLoading && !profile && loadError) {
        return (
          <SafeAreaProvider>
            <View style={styles.loading}>
              <Text style={styles.retryTitle}>Your data couldn't be reached just now.</Text>
              <Text style={styles.retryBody}>{loadError}</Text>
              <View style={styles.retryButton}>
                <PrimaryButton
                  label="Try again"
                  onPress={() => {
                    if (session?.user?.id) loadUserData(session.user.id);
                  }}
                />
              </View>
              <StatusBar style="dark" />
            </View>
          </SafeAreaProvider>
        );
      }

      if (dataLoading || !profile) {
        return (
          <SafeAreaProvider>
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
              <StatusBar style="dark" />
            </View>
          </SafeAreaProvider>
        );
      }
    }

    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <BetaCycle1 userId={session?.user?.id} onComplete={handleOnboardingComplete} />
        {completing ? (
          <View style={styles.completeOverlay} pointerEvents="auto">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}
        {completeError ? (
          <GlassSurface
            kind="regular"
            tintColor={colors.white}
            style={styles.completeErrorBanner}
            fallbackStyle={styles.completeErrorFallback}
          >
            <Text style={styles.completeErrorText}>{completeError}</Text>
          </GlassSurface>
        ) : null}
      </SafeAreaProvider>
    );
  }

  const composition = composeNow({
    sleepNightCount,
    hasHealthObservations: healthSourceConnected,
    understandings,
    relationships,
    lastNightSleepLabel:
      recentSyncSummary?.reflection.sleepMinutes != null
        ? displayCopy(
            `Last night you slept ${formatSleepMinutes(recentSyncSummary.reflection.sleepMinutes)}.`
          )
        : null,
    userNote: userNowNote,
  });
  const careRow = understandings.find(isEligibleCareConnection) ?? null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavAdaptivityProvider>
        <View style={styles.app}>
          <View style={{ flex: 1 }}>
            {tab === 'now' && (
              <NowScreen
                composition={composition}
                receipt={receipt}
                onAdd={() => {
                  setAddError(null);
                  setAddVisible(true);
                }}
                onConnectCare={() => setCareSearchVisible(true)}
              />
            )}
            {tab === 'account' && (
              <AccountScreen
                healthSourceConnected={healthSourceConnected}
                onOpenSources={() => setHealthSyncVisible(true)}
                onOpenPrivacy={() => setDataPrivacyVisible(true)}
                onSignOut={handleSignOut}
              />
            )}
          </View>
          <BottomNav active={tab} onChange={setTab} />
        </View>
      </NavAdaptivityProvider>

      <AddObservationSheet
        visible={addVisible}
        saving={addSaving}
        error={addError}
        onClose={() => setAddVisible(false)}
        onSave={handleSaveObservation}
      />

      <ProviderSearchSheet
        visible={careSearchVisible}
        understandingId={careRow?.id ?? null}
        careRecommendationType={careRow?.care_recommendation_type ?? null}
        profileLocation={profile?.location ?? null}
        onClose={() => setCareSearchVisible(false)}
        onSelectProvider={() => setCareSearchVisible(false)}
      />

      <HealthSyncSheet
        visible={healthSyncVisible}
        userId={session?.user?.id ?? null}
        connected={healthSourceConnected}
        onClose={() => setHealthSyncVisible(false)}
        onSynced={() => {
          console.log('[hksync] Now reload after sync');
          setHealthSourceConnected(true);
          if (session?.user?.id) {
            startHealthKitObservers(session.user.id);
            loadUserData(session.user.id);
          }
        }}
      />

      <DataPrivacySheet
        visible={dataPrivacyVisible}
        userId={session?.user?.id ?? null}
        onClose={() => setDataPrivacyVisible(false)}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  retryTitle: {
    ...type.title2,
    color: colors.ink,
    textAlign: 'center',
  },
  retryBody: {
    ...fontTokens.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  app: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  completeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,252,247,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeErrorBanner: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  completeErrorFallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  completeErrorText: {
    ...fontTokens.sans,
    fontSize: 13,
    color: colors.ink,
  },
});
