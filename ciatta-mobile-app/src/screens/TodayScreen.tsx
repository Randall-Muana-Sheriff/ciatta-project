import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme/tokens';
import type { ActiveCuriosity } from '../lib/curiosity';
import type { CrossDomainUnderstandingRow, RelationshipRow, UnderstandingHistoryRow, UnderstandingRow } from '../lib/queries';
import { derivePriority } from '../lib/priority';
import { whyAvailable } from '../lib/whyLayer';
import { displayCopy } from '../lib/displayCopy';
import ScreenContainer from '../components/ScreenContainer';
import CuriosityCard from '../components/CuriosityCard';
import TamponWearCard from '../components/TamponWearCard';
import WhySheet from '../overlays/WhySheet';
import {
  confirmTamponInserted,
  confirmTamponRemoved,
  loadTamponWearUnderstanding,
} from '../lib/tamponWearData';
import { clearTamponWearNotifications, syncTamponWearNotifications } from '../lib/tamponWearNotify';
import type { TamponAbsorbency, TamponWearUnderstanding } from '../lib/tamponWear';

const THANKS_VISIBLE_MS = 3000;

const WORDMARK = require('../../assets/images/wordmark.png');
const WORDMARK_ASPECT = 3575 / 1046;
const WORDMARK_HEIGHT = 19;

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen({
  userId,
  onOpenDiscoveryNudge,
  onOpenInfo,
  onOpenCore,
  activeCuriosity,
  onAnswerCuriosity,
  hasPendingDiscovery,
  understandings,
  relationships = [],
  preferredName,
  goals = [],
  history = [],
  crossDomain = [],
}: {
  userId?: string | null;
  onOpenDiscoveryNudge: () => void;
  onOpenInfo: () => void;
  onOpenCore: () => void;
  activeCuriosity: ActiveCuriosity | null;
  onAnswerCuriosity: (answer: string) => Promise<void>;
  hasPendingDiscovery: boolean;
  understandings: UnderstandingRow[];
  relationships?: RelationshipRow[];
  preferredName: string;
  goals?: string[];
  history?: UnderstandingHistoryRow[];
  crossDomain?: CrossDomainUnderstandingRow[];
}) {
  const [answered, setAnswered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tamponWear, setTamponWear] = useState<TamponWearUnderstanding | null>(null);
  const [tamponBleeding, setTamponBleeding] = useState(false);
  const [tamponBusy, setTamponBusy] = useState(false);
  const [tamponTick, setTamponTick] = useState(0);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => setAnswered(false), THANKS_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [answered]);

  useEffect(() => {
    const t = setInterval(() => setTamponTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    loadTamponWearUnderstanding(userId)
      .then(async ({ understanding, bleedingNow }) => {
        if (!alive) return;
        setTamponWear(understanding);
        setTamponBleeding(bleedingNow);
        const active =
          understanding.activeTimerState !== 'insufficient' &&
          understanding.activeTimerState !== 'idle';
        if (active) await syncTamponWearNotifications(understanding);
        else await clearTamponWearNotifications();
      })
      .catch(() => {
        if (alive) setTamponWear(null);
      });
    return () => {
      alive = false;
    };
  }, [userId, tamponTick]);

  const now = new Date();
  const dateLabel = displayCopy(
    now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  );

  const featured =
    understandings.length > 0
      ? [...understandings].sort(
          (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
        )[0]
      : null;

  const priority = derivePriority(featured);
  const showWhy =
    featured != null &&
    whyAvailable({
      featured,
      todayNarrative: featured.seeing || featured.narrative,
      todayPriority: priority,
      understandings,
      relationships: relationships.map((r) => ({
        from_domain: r.from_domain,
        to_domain: r.to_domain,
      })),
      crossDomain: crossDomain.map((cd) => ({
        from_domain: cd.from_domain,
        to_domain: cd.to_domain,
        narrative: cd.narrative,
      })),
      history,
    });
  const tamponActive =
    tamponWear != null &&
    tamponWear.activeTimerState !== 'insufficient' &&
    tamponWear.activeTimerState !== 'idle';
  const showTampon = tamponWear != null && (tamponActive || tamponBleeding);

  async function handleTamponInserted(absorbency: TamponAbsorbency) {
    if (!userId) return;
    setTamponBusy(true);
    try {
      await confirmTamponInserted(userId, absorbency);
      setTamponTick((n) => n + 1);
    } finally {
      setTamponBusy(false);
    }
  }

  async function handleTamponRemoved() {
    if (!userId) return;
    setTamponBusy(true);
    try {
      await confirmTamponRemoved(userId);
      setTamponTick((n) => n + 1);
    } finally {
      setTamponBusy(false);
    }
  }

  async function handleAnswer(answer: string) {
    setSubmitError(null);
    try {
      await onAnswerCuriosity(answer);
      setAnswered(true);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "That didn't save. Try again."
      );
    }
  }

  return (
    <>
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About the Today screen"
          onPress={onOpenInfo}
          hitSlop={8}
        >
          <Image
            source={WORDMARK}
            style={styles.wordmark}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Ciatta"
          />
        </Pressable>
        <Text style={styles.greeting}>
          {greeting(now)}
          {preferredName ? `, ${preferredName}` : ''}
        </Text>
        <Text style={styles.date}>{dateLabel}</Text>
      </View>

      {featured ? (
        <View style={styles.section}>
          <Text style={styles.headline}>{featured.seeing || featured.narrative}</Text>
          {priority ? (
            <Text style={styles.guidance}>{priority.text}</Text>
          ) : null}
          {showWhy ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Why Ciatta believes this"
              onPress={() => setWhyOpen(true)}
              style={({ pressed }) => [styles.whyRow, pressed && styles.pressedSoft]}
            >
              <Text style={styles.whyLabel}>Why</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.headline}>Your picture is still taking shape.</Text>
          <Text style={styles.body}>
            There isn't enough evidence yet to notice a pattern. As you share
            more and connect your data, what you've learned will appear here.
          </Text>
        </View>
      )}

      {showTampon && tamponWear ? (
        <View style={styles.block}>
          <TamponWearCard
            understanding={tamponWear}
            bleedingNow={tamponBleeding}
            busy={tamponBusy}
            onConfirmInserted={handleTamponInserted}
            onConfirmRemoved={handleTamponRemoved}
          />
        </View>
      ) : null}

      {answered || activeCuriosity ? (
        <View style={styles.block}>
          {answered ? (
            <Text style={styles.thanks}>
              Thank you. This is becoming part of your understanding.
            </Text>
          ) : activeCuriosity ? (
            <>
              <CuriosityCard
                question={activeCuriosity.question}
                purpose={activeCuriosity.purpose}
                options={activeCuriosity.answerOptions}
                onAnswer={handleAnswer}
              />
              {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}

      {hasPendingDiscovery ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenDiscoveryNudge}
          style={({ pressed }) => [styles.nudgeFooter, pressed && styles.pressedSoft]}
        >
          <Text style={styles.nudgeText}>
            Something new is becoming part of your story.
          </Text>
        </Pressable>
      ) : null}
    </ScreenContainer>
    <WhySheet
      visible={whyOpen}
      featured={featured}
      todayNarrative={featured?.seeing || featured?.narrative || ''}
      todayPriority={priority}
      understandings={understandings}
      relationships={relationships}
      crossDomain={crossDomain}
      history={history}
      goals={goals}
      userId={userId}
      onClose={() => setWhyOpen(false)}
      onOpenCore={() => {
        setWhyOpen(false);
        onOpenCore();
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 36,
  },
  wordmark: {
    height: WORDMARK_HEIGHT,
    width: WORDMARK_HEIGHT * WORDMARK_ASPECT,
    tintColor: colors.ink,
  },
  greeting: {
    ...type.subheadline,
    color: colors.ink2,
    marginTop: 18,
  },
  date: {
    ...type.footnote,
    color: colors.ink3,
    marginTop: 4,
  },
  pressedSoft: {
    opacity: 0.6,
  },
  section: {},
  headline: {
    ...type.title1,
    color: colors.ink,
  },
  body: {
    ...type.body,
    color: colors.ink2,
    marginTop: 16,
  },
  guidance: {
    ...type.body,
    color: colors.ink2,
    marginTop: 16,
  },
  whyRow: {
    alignSelf: 'flex-start',
    marginTop: 28,
    minHeight: 44,
    justifyContent: 'center',
  },
  whyLabel: {
    ...type.headline,
    color: colors.ink,
  },
  block: {
    marginTop: 40,
  },
  thanks: {
    ...type.title3,
    color: colors.ink,
  },
  submitError: {
    ...type.footnote,
    color: colors.accent,
    marginTop: 10,
  },
  nudgeFooter: {
    marginTop: 40,
    marginBottom: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  nudgeText: {
    ...type.body,
    color: colors.ink2,
  },
});
