import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { connectAppleHealth } from '../lib/connectHealth';
import { Composer } from '../ui/composer';
import { displayCopy } from '../lib/displayCopy';
import { encryptionNote, healthDisclosureParagraph, importSummaryLine, monogram, SYNC_APPS } from '../lib/healthDisclosure';
import { latestReadings, type Reading, workoutCount } from '../lib/healthReadings';
import { compileStages, readingsHeadline, type StageId, stageState } from '../lib/firstProfile';
import { guideFor } from '../lib/syncInstructions';
import {
  AGE_RANGES,
  type AgeRange,
  type Answers,
  cycleIsRelevant,
  emptyAnswers,
  INTENTS,
  type Intent,
  LIFE_STAGES,
  type LifeStage,
  reflectionParagraph,
  type StepId,
  stepsFor,
} from '../lib/onboarding';
import { useRepo, useSession } from '../state/session';
import { font, GUTTER, RADIUS } from '../theme';
import { Icon } from '../ui/icons';
import { images } from '../ui/images';
import { Ground } from '../ui/Ground';
import { L } from '../ui/surface';
import { Wordmark } from '../ui/Wordmark';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// The first session: six screens in three phases.
//
// Light, not dark. The rest of the app is a dark record she reads; this is a
// conversation she is having, and the two should not feel like one surface.
// Black on white also buys the most contrast available on the one screen
// where she is reading questions rather than glancing at numbers.
//
// The copy is short on purpose. Most sentences here were paragraphs in the
// first build, and a paragraph above a text box is a second thing to read
// before she can answer the first. What survived is the question, and where
// it genuinely changes her answer, one line saying why it is asked.

// Where a screen's content sits, by how much of it there is.
//
// A short screen centres: one question and one field at eye level is easier
// to glance at than the same pair pushed to the foot of an empty page. A long
// screen bottom aligns, so the answer and the controls stay in reach and the
// overflow runs upward into space the screen has anyway.
//
// Membership is about content, not importance. The three below are the only
// screens with enough on them to want the foot of the page: the text area she
// writes into, the eight life stages, and the reflection paragraph. Every
// other screen holds one question and sits at eye level.
const BOTTOM: StepId[] = ['tell', 'lifeStage', 'connect', 'reflect'];

// The screens that hold exactly one answer, and so need no Continue: the tap
// that answers the question is the tap that moves her on. A Continue button
// here is a second tap that adds nothing, and a woman who has already told
// Ciatta her age has no reason to confirm it.
const AUTO: StepId[] = ['age', 'lifeStage', 'cycle'];

// Screens that render no Continue at the foot. The three above answer
// themselves, and connect carries its own action: a Continue under Connect
// Apple Health is a second button for a screen with one thing to do, and the
// quieter of the two would be the one that does nothing.
const NO_CONTINUE: StepId[] = [...AUTO, 'connect', 'compiling'];


// Onboarding kept four local values while it was the one white surface in
// a dark app. They point at the shared surface now, so the first session
// moves with everything else rather than being the screen somebody forgets.
// Paper, for the mark over the photograph.
const PAPER = '#F2F3F4';

const INK = L.ink;
const MUTED = L.meta;
const LINE = L.rule;
const FIELD = L.recessed;

// Dots, not "Step 8 of 9". A counter invites her to work out how much is
// left and feel it as a cost. Dots say the same thing with no number to
// resent.
function Dots({ index, total }: { index: number; total: number }) {
  return (
    <View style={s.dots} accessible accessibilityLabel={`Step ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, n) => (
        <View key={n} style={[s.dot, n <= index && s.dotOn]} />
      ))}
    </View>
  );
}

function Choices({
  options,
  selected,
  onPick,
}: {
  options: readonly string[];
  selected: string | null;
  onPick: (o: string) => void;
}) {
  return (
    <View style={s.choices} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o === selected;
        return (
          <Pressable
            key={o}
            onPress={() => onPick(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [s.choice, on && s.choiceOn, pressed && s.pressed]}
          >
            <Text style={[font('body'), { color: INK }]}>{o}</Text>
            {on ? <Icon name="check" size={18} color={INK} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: readonly string[];
  onToggle: (o: string) => void;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => onToggle(o)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.pressed]}
          >
            <Text style={[font('subhead'), { color: on ? L.canvas : INK }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A free text list. Nobody's medication list is a multiple choice question.
function AddList({
  placeholder,
  items,
  onChange,
  accessibilityLabel,
}: {
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
  accessibilityLabel: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    // Case insensitive: Magnesium and magnesium are one thing, and showing
    // both back would look like Ciatta was not listening.
    if (!items.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setDraft('');
  };
  return (
    <View style={s.field}>
      <View style={s.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          returnKeyType="done"
          style={[font('body'), s.input]}
          accessibilityLabel={accessibilityLabel}
        />
        <Pressable onPress={add} accessibilityRole="button" style={({ pressed }) => [s.add, pressed && s.pressed]}>
          <Text style={[font('subhead', 'semibold'), { color: INK }]}>Add</Text>
        </Pressable>
      </View>
      {items.length ? (
        <View style={s.chips}>
          {items.map((x) => (
            <Pressable
              key={x}
              onPress={() => onChange(items.filter((y) => y !== x))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${x}`}
              style={({ pressed }) => [s.chip, s.chipOn, pressed && s.pressed]}
            >
              <Text style={[font('subhead'), { color: L.canvas }]}>{x}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const SYMPTOMS = [
  'Fatigue',
  'Bloating',
  'Poor sleep',
  'Nausea',
  'Headache',
  'Mood changes',
  'Breast tenderness',
  'Digestion',
  'Bowel changes',
  'Pain',
  'Dizziness',
];

const CYCLE_CHOICES = ['Under 24 days', '24 to 27 days', '28 to 31 days', '32 days or more', 'Too irregular to say'];

// Ranges, not a number field. A woman asked for an exact length either counts
// back through a calendar or invents one, and an invented number is worse
// than a range.
function cycleChoice(length: number | null, regular: boolean | null): string[] {
  if (regular === false) return ['Too irregular to say'];
  if (length == null) return [];
  if (length < 24) return ['Under 24 days'];
  if (length <= 27) return ['24 to 27 days'];
  if (length <= 31) return ['28 to 31 days'];
  return ['32 days or more'];
}

function cycleFromChoice(label: string, a: Answers): Partial<Answers> {
  if (cycleChoice(a.cycleLength, a.cycleRegular)[0] === label) return { cycleLength: null, cycleRegular: null };
  switch (label) {
    // The midpoint of the range she chose. Nothing downstream may treat this
    // as a measured cycle length.
    case 'Under 24 days':
      return { cycleLength: 22, cycleRegular: true };
    case '24 to 27 days':
      return { cycleLength: 26, cycleRegular: true };
    case '28 to 31 days':
      return { cycleLength: 29, cycleRegular: true };
    case '32 days or more':
      return { cycleLength: 33, cycleRegular: true };
    case 'Too irregular to say':
      return { cycleLength: null, cycleRegular: false };
    default:
      return {};
  }
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const repo = useRepo();
  const { userId, reloadFirstName, signOut } = useSession();
  const insets = useSafeAreaInsets();

  const [a, setA] = useState<Answers>(emptyAnswers());
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [sourceNote, setSourceNote] = useState('');
  // Whether Apple Health is actually connected, read from health_sources
  // rather than inferred from having tapped the button. A label saying
  // Connected when the row says refused would be the screen stating
  // something it does not know.
  const [appleConnected, setAppleConnected] = useState(false);
  // What the last run actually brought in. Null until one has run.
  const [imported, setImported] = useState<ReturnType<typeof importSummaryLine>>('');
  // Her own readings, straight out of the day rows Today is built from. Not
  // counts: a woman who has just connected wants to see her step count.
  const [readings, setReadings] = useState<Reading[]>([]);
  const [workouts, setWorkouts] = useState(0);
  // Which app's instructions are open. Null is the resting state: seven
  // cards open at once would bury the button under them.
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  // How far the first profile has got. Null means nothing has finished yet,
  // and each value means the work that stage names is actually done.
  const [stageDone, setStageDone] = useState<StageId | null>(null);
  const [readingCount, setReadingCount] = useState(0);

  const refreshReadings = useCallback(async () => {
    try {
      const days = await repo.loadDays();
      setReadings(latestReadings(days));
      setWorkouts(workoutCount(days));
    } catch {
      // Nothing shown rather than something invented.
    }
  }, [repo]);

  const refreshAppleStatus = useCallback(async () => {
    try {
      const sources = await repo.loadSources();
      setAppleConnected(sources.some((x) => x.name === 'Apple Health' && x.status === 'active'));
    } catch {
      // A failed read leaves the label off. Showing Connected because the
      // check failed would be the one wrong answer.
    }
  }, [repo]);


  const steps = useMemo(() => stepsFor(a), [a]);
  const step: StepId = steps[Math.min(i, steps.length - 1)];
  // Her readings go into the profile, so a woman who connected Apple Health
  // is not told nothing was measured.
  const paragraph = useMemo(() => reflectionParagraph(a, readings), [a, readings]);

  // Read when she arrives at the connect screen, so a source connected on an
  // earlier run shows as connected rather than waiting on a tap.
  useEffect(() => {
    if (step !== 'connect') return;
    void refreshAppleStatus();
    void refreshReadings();
  }, [step, refreshAppleStatus, refreshReadings]);

  // The first profile builds itself on arrival. Guarded on stageDone so a
  // re render cannot start a second run over the first.
  const started = useRef(false);
  useEffect(() => {
    if (step !== 'compiling' || started.current) return;
    started.current = true;
    void buildProfile();
    // buildProfile is stable for this screen's lifetime in practice, and
    // listing it would restart the run on every state change it causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));
  const next = () => setI((n) => Math.min(n + 1, steps.length - 1));

  // Cleared on unmount so a pending advance cannot set state on a screen that
  // has gone, which is what happens if she taps an answer and the save
  // finishes underneath her.
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advance.current) clearTimeout(advance.current);
  }, []);
  const pick = (patch: Partial<Answers>) => {
    set(patch);
    if (advance.current) clearTimeout(advance.current);
    advance.current = setTimeout(next, 180);
  };
  const back = () => setI((n) => Math.max(n - 1, 0));
  const skip = () => {
    setA((prev) => (prev.skipped.includes(step) ? prev : { ...prev, skipped: [...prev.skipped, step] }));
    next();
  };
  const toggle = <T extends string>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const onConnectHealth = async () => {
    if (connecting || !userId) return;
    setConnecting(true);
    try {
      const result = await connectAppleHealth({
        userId,
        saveStatus: (kind, status, lastSyncedAt) => repo.saveSourceStatus(kind, status, lastSyncedAt),
        // Dropped on purpose. The progress lines said what was happening
        // while it happened, and what she sees instead is the button reading
        // Connecting, which says the same thing without a sentence.
        onNote: () => {},
      });
      setSourceNote(result.connected ? '' : result.message);
      setImported(importSummaryLine(result.imported));
      setReadingCount(result.imported?.observations ?? 0);
      await refreshAppleStatus();
      await refreshReadings();
      // Permission given is the end of this screen's job. Everything on it
      // below the button is explanation she needs once, before deciding,
      // and leaving her to find Skip afterwards would be the app waiting
      // for nothing.
      next();
    } catch {
      setSourceNote('That did not connect. You can try again from Profile.');
    } finally {
      setConnecting(false);
    }
  };

  // Walks the stages by doing the work, not by waiting. Each setStageDone
  // happens after the thing it names has finished, which is the difference
  // between a progress list and a spinner with captions.
  const buildProfile = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    setStageDone(null);
    try {
      // Read again here rather than trusting the connect screen to have
      // done it. A woman who skipped that screen, having connected on an
      // earlier run, still has readings, and a profile that omitted them
      // would tell her nothing was measured while her record holds a year.
      await refreshReadings();
      setStageDone('readings');
      await new Promise((r) => setTimeout(r, 450));
      setStageDone('answers');
      await repo.completeOnboarding(a);
      setStageDone('saved');
      await reloadFirstName();
      await new Promise((r) => setTimeout(r, 450));
      setStageDone('profile');
      await new Promise((r) => setTimeout(r, 350));
      setI((n) => Math.min(n + 1, steps.length - 1));
    } catch {
      // Her answers stay in state and the record stays unfinished, so the
      // next launch resumes rather than dropping her into an empty Today.
      setError('That did not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // Nothing left to write: the record was saved on the screen before, which
  // is the only screen that could honestly tick "Saved it to your record".
  const finish = () => onDone();

  // The welcome screen is its own layout, not a variant of the white one.
  // It is the only screen with a photograph behind it, and the photograph
  // runs from luminance 222 at the top to 41 at the bottom, so neither black
  // nor white text works across the whole of it. The gradient below lands it
  // dark enough for white type everywhere without flattening the picture
  // where nothing sits on top of it.
  if (step === 'welcome') {
    return (
      // Its own ground, as before: the photograph covers this screen and
      // the colour behind it is only what shows while the image loads.
      <View style={[s.fill, s.fillPhoto]}>
        <Image source={images.welcomeBg} style={s.bg} resizeMode="cover" accessible={false} />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="welcomeScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.45} />
              <Stop offset="0.45" stopColor="#000000" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.72} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcomeScrim)" />
        </Svg>

        <View style={[s.welcomeTop, { paddingTop: insets.top + 24 }]}>
          {/*
            It reads as back and it signs her out, because on this screen
            those are the same move: the screen behind it is the sign in
            screen, and nothing she has entered is lost by going there. The
            hint says so, since an arrow that ends a session is otherwise a
            surprise to anyone who cannot see where it leads.
          */}
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityHint="Signs you out and returns to the sign in screen"
            hitSlop={8}
            style={({ pressed }) => [s.backAbs, { top: insets.top + 24 - 11 }, pressed && s.pressed]}
          >
            <Svg width={11} height={19} viewBox="0 0 11 19">
              <Path
                d="M9.5 1.5 2 9.5l7.5 8"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Pressable>
          {/* Paper on the photograph. The Constitution allows Graphite
              or Paper and nothing else, and the scrim is dark here.
              This said Paper and passed L.recessed, which is five and a
              half percent white: a watermark token for a translucent
              panel, invisible over a photograph. */}
          <Wordmark color={PAPER} />
        </View>

        {/* Heading, paragraph and the button sit together in the vertical
            middle rather than split top and bottom. */}
        <View style={[s.welcomeMid, { paddingBottom: insets.bottom }]}>
          <Text
            style={[font('title2'), s.titleOnPhoto]}
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            Let&rsquo;s put the pieces together.
          </Text>
          <Text style={[font('body'), s.ledeOnPhoto]}>
            Bring your devices, labs, and daily symptoms together. Spot clear patterns, understand what&rsquo;s
            shifting, and get active help with appointments, referrals, and insurance.
          </Text>
          <Pressable
            onPress={next}
            accessibilityRole="button"
            style={({ pressed }) => [s.primaryOnPhoto, pressed && s.pressed]}
          >
            <Text style={[font('headline'), { color: INK }]}>Begin</Text>
          </Pressable>

        </View>
      </View>
    );
  }

  return (
    <Ground>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/*
        Back, progress, and Skip, in one row that holds still while a long
        screen moves under it. Back is an arrow in the corner because that is
        where a back arrow is, and because the bottom of the screen is for the
        one thing she came to this screen to do.

        Skip moved up here with it. It was beside Continue at the same weight,
        on the argument that Ciatta works on partial answers and a skip styled
        as the lesser choice says otherwise. That argument still holds and this
        is a different one: on the screens that answer themselves there is no
        Continue left for it to stand beside, and a lone Skip at the foot of
        the page is a button she has to read before she can ignore it.
      */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        {/*
          Neither control renders while the profile is building. Back would
          walk her out of a save in progress and Skip would abandon it, and
          the screen finishes on its own in a couple of seconds anyway.
        */}
        {step === 'compiling' ? (
          <View style={s.headerSide} />
        ) : (
          <Pressable
            onPress={back}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={({ pressed }) => [s.headerSide, s.headerLeft, pressed && s.pressed]}
          >
            <Icon name="chevronLeft" size={22} color={INK} />
          </Pressable>
        )}

        <Dots index={i - 1} total={steps.length - 1} />

        {/*
          The wait, with the work named. Each line ticks when the thing it
          names has actually finished: the readings are counted, her answers
          are written, the record is saved. A list that advanced on a timer
          while nothing happened would be a lie told with a spinner, and it
          is the easiest one in an app to tell by accident.
        */}
        {step === 'compiling' ? (
          <View style={s.compile}>
            <Text style={[font('largeTitle'), s.countBig]} accessibilityRole="header">
              {readingsHeadline(readingCount)}
            </Text>
            <Text style={[font('subhead'), s.countUnder]}>
              {readingCount === 1 ? 'reading imported' : 'readings imported'}
            </Text>

            <Text style={[font('title2'), s.compileTitle]}>Building your health profile</Text>

            {compileStages(readingCount).map((stage) => {
              const state = stageState(stage.id, stageDone);
              return (
                <View key={stage.id} style={[s.stageRow, state === 'waiting' && s.stageWaiting]}>
                  <View style={[s.stageMark, state === 'done' && s.stageMarkDone]}>
                    {state === 'done' ? <Icon name="check" size={13} color="#FFFFFF" /> : null}
                  </View>
                  <Text
                    style={[font('subhead', state === 'waiting' ? 'regular' : 'semibold'), s.stageText]}
                    accessibilityLiveRegion={state === 'running' ? 'polite' : 'none'}
                  >
                    {displayCopy(stage.label)}
                  </Text>
                </View>
              );
            })}

            {error ? (
              <View>
                <Text style={[font('footnote'), s.error]} accessibilityLiveRegion="polite">
                  {displayCopy(error)}
                </Text>
                <Pressable
                  onPress={() => void buildProfile()}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.primary, s.connect, pressed && s.pressed]}
                >
                  <Text style={[font('headline'), { color: L.canvas }]}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 'reflect' || step === 'compiling' ? (
          <View style={s.headerSide} />
        ) : (
          <Pressable
            onPress={skip}
            accessibilityRole="button"
            style={({ pressed }) => [s.headerSide, s.headerRight, pressed && s.pressed]}
          >
            <Text style={[font('subhead'), { color: MUTED }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      {/*
        Bottom aligned, because the question and its answer belong where her
        thumb already is. flexGrow with flex end does this without costing the
        long screens anything: when the content outgrows the viewport the
        alignment stops applying and it scrolls as before.
      */}
      <ScrollView
        style={s.fill}
        contentContainerStyle={[
          s.body,
          { justifyContent: BOTTOM.includes(step) ? 'flex-end' : 'center', paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >

        {/*
          Her name, and the first question she is asked. The account's name is
          not used: on a Google or Apple sign in it is whatever the account
          holder typed, often a full legal name, and greeting her with it every
          morning would be the app talking to a stranger. One field, no
          surname, because nothing in Ciatta needs one.
        */}
        {step === 'name' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              What may I call you?
            </Text>
            <TextInput
              value={a.name}
              onChangeText={(t) => set({ name: t })}
              placeholder="Your name"
              placeholderTextColor={MUTED}
              autoCapitalize="words"
              autoComplete="given-name"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={next}
              style={[font('body'), s.input]}
              accessibilityLabel="What may I call you"
            />
          </View>
        ) : null}

        {step === 'intent' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              What brings you here?
            </Text>
            <Chips
              options={INTENTS.map((o) => o.label)}
              selected={a.intents.map((id) => INTENTS.find((o) => o.id === id)?.label ?? '')}
              onToggle={(label) => {
                const id = INTENTS.find((o) => o.label === label)?.id;
                if (id) set({ intents: toggle(a.intents, id as Intent) });
              }}
            />
          </View>
        ) : null}

        {step === 'tell' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              What has been changing?
            </Text>
            {/*
              The shared box. This screen invented the one control in the
              corner idea and carried its own copy of it for a while, which
              meant the mic, the send, the stop and the listening line
              existed twice and could drift. ui/composer.tsx owns it now,
              so she gets the plus and its four ways in here too.
            */}
            <Composer
              value={a.opening}
              onChange={(t: string, how: 'typed' | 'spoken') => set({ opening: t, openingMode: how })}
              placeholder="However you would say it to a friend"
              label="What has been changing"
              // No attachments at this point. Answers has nowhere to put a
              // file and onboarding has not created her record yet, so the
              // plus stays hidden rather than taking a photo that would
              // have nowhere to land. Everything else is the shared box.
              onSend={next}
            />
          </View>
        ) : null}

        {/*
          Nine questions, nine screens, and the control is chosen per question
          rather than applied uniformly.

          Single answer, short closed list: a full width row list. Several
          answers from a known set: chips, which is what they were always for.
          An answer only she can supply: a text field that adds to a list, so
          a woman on four medications is not fighting a control built for one.
        */}
        {step === 'age' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              How old are you?
            </Text>
            <Choices
              options={AGE_RANGES.map((o) => o.label)}
              selected={AGE_RANGES.find((o) => o.id === a.ageRange)?.label ?? null}
              onPick={(label) => pick({ ageRange: AGE_RANGES.find((o) => o.label === label)?.id as AgeRange })}
            />
          </View>
        ) : null}

        {step === 'lifeStage' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              Where are you right now?
            </Text>
            <Choices
              options={LIFE_STAGES.map((o) => o.label)}
              selected={LIFE_STAGES.find((o) => o.id === a.lifeStage)?.label ?? null}
              onPick={(label) => pick({ lifeStage: LIFE_STAGES.find((o) => o.label === label)?.id as LifeStage })}
            />
          </View>
        ) : null}

        {step === 'cycle' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              How long is your usual cycle?
            </Text>
            <Choices
              options={CYCLE_CHOICES}
              selected={cycleChoice(a.cycleLength, a.cycleRegular)[0] ?? null}
              // Read against a cleared cycle rather than her current one, so
              // the toggle off branch cannot fire. On a screen that advances
              // on tap, a tap that both deselects and moves her on would land
              // her at the next question having dropped the answer she just
              // gave.
              onPick={(label) => pick(cycleFromChoice(label, { ...a, cycleLength: null, cycleRegular: null }))}
            />
          </View>
        ) : null}

        {step === 'symptoms' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              What have you been noticing?
            </Text>
            <Chips options={SYMPTOMS} selected={a.symptoms} onToggle={(v) => set({ symptoms: toggle(a.symptoms, v) })} />
          </View>
        ) : null}

        {step === 'conditions' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              Anything you have been diagnosed with?
            </Text>
            <AddList
              accessibilityLabel="Diagnosed conditions"
              placeholder="Endometriosis, PCOS, thyroid"
              items={a.conditions}
              onChange={(conditions) => set({ conditions })}
            />
          </View>
        ) : null}

        {step === 'surgeries' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              Any surgeries?
            </Text>
            <AddList
              accessibilityLabel="Surgeries"
              placeholder="Laparoscopy"
              items={a.surgeries}
              onChange={(surgeries) => set({ surgeries })}
            />
          </View>
        ) : null}

        {step === 'medications' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              What do you take?
            </Text>
            <AddList
              accessibilityLabel="Medications"
              placeholder="Levothyroxine"
              items={a.medications}
              onChange={(medications) => set({ medications })}
            />
          </View>
        ) : null}

        {step === 'supplements' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              Any supplements?
            </Text>
            <AddList
              accessibilityLabel="Supplements"
              placeholder="Magnesium"
              items={a.supplements}
              onChange={(supplements) => set({ supplements })}
            />
          </View>
        ) : null}

        {step === 'goals' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              What do you want to understand?
            </Text>
            <AddList
              accessibilityLabel="What you want to understand"
              placeholder="Why I am so tired"
              items={a.goals}
              onChange={(goals) => set({ goals })}
            />
          </View>
        ) : null}

        {step === 'connect' ? (
          <View>
            <Text style={[font('title1'), s.titleCentre]} accessibilityRole="header">
              Sync your health data
            </Text>
            <Text style={[font('subhead'), s.connectLede]}>{displayCopy(healthDisclosureParagraph())}</Text>

            {/*
              Apple Health, described rather than operated. The button that
              raises Apple's sheet sits at the foot of the screen now, after
              the encryption line, so she reads what is collected and how it
              is held before anything asks her for it.

              The heart is drawn from Ciatta's own icon set in Health's pink,
              not Apple's app icon. Apple's artwork is theirs, and the only
              copy of it in this repo turned out to be the plain black Apple
              mark, which is a different logo for a different thing.
            */}
            <View style={s.sourceCard}>
              <View style={s.appleTile}>
                <Icon name="heart" size={22} color="#FA114F" filled />
              </View>
              <View style={s.rowText}>
                <Text style={[font('headline'), { color: INK }]}>Apple Health</Text>
                <Text style={[font('footnote'), s.rowDetail]}>
                  Sync data from your iPhone, Apple Watch and other connected apps.
                </Text>
              </View>
              {appleConnected ? (
                <View style={s.connectedPill}>
                  <Icon name="check" size={13} color="#0B7A4B" />
                  <Text style={[font('caption1', 'semibold'), s.connectedText]}>Connected</Text>
                </View>
              ) : null}
            </View>

            {/*
              Named rather than integrated. Ciatta reads Apple Health; these
              are apps that write there, so the heading has to say via Apple
              Health or the list reads as a set of partnerships that do not
              exist.

              A row that scrolls sideways rather than a list down the page:
              seven names stacked would be the tallest thing on a screen
              where they are the least important thing on it.
            */}
            <Text style={[font('subhead', 'semibold'), s.groupHeading]}>Apps that sync via Apple Health</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.appRail}
              contentContainerStyle={s.appRailInner}
            >
              {SYNC_APPS.map((app) => {
                const open = openGuide === app.name;
                return (
                  <Pressable
                    key={app.name}
                    onPress={() => setOpenGuide(open ? null : app.name)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${app.name}, how to connect it to Apple Health`}
                    style={({ pressed }) => [s.appTile, open && s.appTileOn, pressed && s.pressed]}
                  >
                    {app.mark ? (
                      <Image source={images[app.mark]} style={s.appMark} resizeMode="contain" accessible={false} />
                    ) : (
                      // No artwork yet. A monogram is a visible gap; another
                      // company's logo would be a wrong answer.
                      <View style={s.appMonogram}>
                        <Text style={[font('caption1', 'semibold'), { color: MUTED }]}>{monogram(app.name)}</Text>
                      </View>
                    )}
                    <Text style={[font('caption1'), s.appLabel]} numberOfLines={1}>
                      {app.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/*
              One card at a time, under the rail it belongs to. These describe
              other companies' menus, so each one carries the date a human
              last checked it rather than reading as permanent truth.
            */}
            {(() => {
              const guide = openGuide ? guideFor(openGuide) : null;
              if (!guide) return null;
              return (
                <View style={s.guideCard}>
                  <View style={s.guideTop}>
                    <Icon name="heart" size={16} color="#FA114F" filled />
                    <Text style={[font('headline'), s.guideTitle]} accessibilityRole="header">
                      {guide.title}
                    </Text>
                    <Pressable
                      onPress={() => setOpenGuide(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      hitSlop={10}
                      style={({ pressed }) => [s.guideClose, pressed && s.pressed]}
                    >
                      <Icon name="xmark" size={15} color={MUTED} />
                    </Pressable>
                  </View>
                  {guide.steps.map((stepText, n) => (
                    <View key={stepText} style={s.guideStep}>
                      <Text style={[font('subhead', 'semibold'), s.guideNumber]}>{n + 1}.</Text>
                      <Text style={[font('subhead'), s.guideText]}>{displayCopy(stepText)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            <View style={s.encryptionCard}>
              <Icon name="shield" size={18} color={INK} />
              <Text style={[font('footnote'), s.encryptionText]}>{displayCopy(encryptionNote())}</Text>
            </View>

            {/*
              The one control on the screen, and the last thing on it. It
              raises Apple's sheet, where the per type toggles are real and
              Turn On All is hers to tap.
            */}
            <Pressable
              onPress={onConnectHealth}
              accessibilityRole="button"
              accessibilityState={{ disabled: connecting }}
              style={({ pressed }) => [s.primary, s.connect, pressed && s.pressed]}
            >
              <Text style={[font('headline'), { color: L.canvas }]}>
                {connecting ? 'Connecting' : 'Connect to Apple Health'}
              </Text>
            </Pressable>

            {/*
              Her own readings, which is the only proof that any of this
              worked. A count says a sync ran; a step count says Apple Health
              handed over her data and Ciatta can read it.

              Every row here came out of a day row. A reading that never
              arrived is absent rather than zero, and each carries the day it
              is from, because the newest heart rate may be three days old
              and a bare number would read as this morning's.
            */}
            {readings.length ? (
              <View style={s.readingCard}>
                <Text style={[font('caption1'), s.groupTitle]}>FROM APPLE HEALTH</Text>
                {readings.map((r, n) => (
                  <View key={r.label} style={[s.readingRow, n > 0 && s.rowDivided]}>
                    <Text style={[font('subhead'), { color: MUTED }]}>{r.label}</Text>
                    <Text style={[font('subhead', 'semibold'), { color: INK }]}>{r.value}</Text>
                  </View>
                ))}
                {workouts > 0 ? (
                  <View style={[s.readingRow, s.rowDivided]}>
                    <Text style={[font('subhead'), { color: MUTED }]}>Workouts</Text>
                    <Text style={[font('subhead', 'semibold'), { color: INK }]}>{workouts}</Text>
                  </View>
                ) : null}
                <Text style={[font('caption1'), s.readingNote]}>
                  {displayCopy(`Most recent reading, from ${readings[0].on}.`)}
                </Text>
              </View>
            ) : null}

            {imported ? (
              <Text style={[font('footnote'), s.imported]} accessibilityLiveRegion="polite">
                {displayCopy(imported)}
              </Text>
            ) : null}
            {sourceNote ? (
              <Text style={[font('footnote'), s.cardSub]} accessibilityLiveRegion="polite">
                {displayCopy(sourceNote)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 'reflect' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              Here is what Ciatta has
            </Text>

            <Text style={[font('subhead'), s.prose]}>{displayCopy(paragraph)}</Text>

            {error ? (
              <Text style={[font('footnote'), s.error]} accessibilityLiveRegion="polite">
                {displayCopy(error)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/*
          Skip sits beside Continue at the same height and the same type, not
          under it as a smaller link. Ciatta works on partial answers, and a
          skip styled as the lesser choice tells her the opposite of what the
          product actually does.
        */}
        {/*
          Nothing at all on the screens that answer themselves. Continue is
          full width on the rest, since Skip no longer stands beside it.
        */}
        {step === 'reflect' ? (
          <View style={s.actions}>
            <Pressable onPress={finish} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && s.pressed]}>
              <Text style={[font('headline'), { color: L.canvas }]}>{saving ? 'Saving' : 'Done'}</Text>
            </Pressable>
          </View>
        ) : NO_CONTINUE.includes(step) ? null : (
          <View style={s.actions}>
            <Pressable onPress={next} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && s.pressed]}>
              <Text style={[font('headline'), { color: L.canvas }]}>Continue</Text>
            </Pressable>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Ground>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  fillPhoto: { backgroundColor: L.canvas },
  body: { paddingHorizontal: GUTTER, flexGrow: 1, paddingTop: 16 },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  welcomeTop: { alignItems: 'center', paddingHorizontal: GUTTER },
  welcomeMid: { flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER },
  // Centred on the mark rather than sitting on its top edge: the control is
  // 44pt tall against a 22pt mark, so it is lifted by half the difference.
  // The offset is applied inline because this container holds its own top
  // padding, which makes its top edge the top of the screen rather than the
  // top of the mark.
  backAbs: {
    position: 'absolute',
    left: GUTTER,
    zIndex: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleOnPhoto: { color: '#FFFFFF', letterSpacing: -0.4 },
  ledeOnPhoto: { color: 'rgba(255,255,255,0.88)', marginTop: 16, lineHeight: 26 },
  primaryOnPhoto: {
    height: 52,
    borderRadius: RADIUS,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  prose: { color: INK, lineHeight: 22, marginTop: 8 },
  // The tile echoes Apple's own, which is the screen she sees one tap later.
  healthTile: {
    width: 62,
    height: 62,
    borderRadius: 15,
    backgroundColor: FIELD,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  titleCentre: { color: INK, letterSpacing: -0.4, textAlign: 'center' },
  connectLede: { color: MUTED, marginTop: 8, lineHeight: 21, textAlign: 'center' },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    padding: 14,
    borderRadius: RADIUS,
    backgroundColor: FIELD,
  },
  appleTile: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: L.recessed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  rowText: { flex: 1 },
  rowDetail: { color: MUTED, marginTop: 2 },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E3F5EA',
  },
  connectedText: { color: '#0B7A4B' },
  groupHeading: { color: INK, marginTop: 28, marginBottom: 10 },
  // The rail bleeds into the gutter so a tile can sit half off the edge,
  // which is what tells her it scrolls without a scrollbar saying so.
  appRail: { marginHorizontal: -GUTTER },
  appRailInner: { paddingHorizontal: GUTTER, gap: 10 },
  appTile: {
    width: 78,
    paddingVertical: 12,
    borderRadius: RADIUS,
    backgroundColor: FIELD,
    alignItems: 'center',
    gap: 8,
  },
  appLabel: { color: MUTED, maxWidth: 66, textAlign: 'center' },
  // The selected tile is outlined rather than filled: a filled tile would
  // fight the brand mark sitting inside it.
  appTileOn: { borderWidth: 1.5, borderColor: INK, backgroundColor: L.statement },
  guideCard: { marginTop: 14, backgroundColor: FIELD, borderRadius: RADIUS, padding: 16 },
  guideTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guideTitle: { flex: 1, color: INK },
  guideClose: { width: 28, height: 28, alignItems: 'flex-end', justifyContent: 'flex-start' },
  guideStep: { flexDirection: 'row', gap: 10, marginTop: 12 },
  guideNumber: { color: INK, minWidth: 18 },
  guideText: { flex: 1, color: INK, lineHeight: 21 },
  compile: { alignItems: 'stretch' },
  countBig: { color: INK, textAlign: 'center', letterSpacing: -1 },
  countUnder: { color: MUTED, textAlign: 'center', marginTop: 2 },
  compileTitle: { color: INK, textAlign: 'center', marginTop: 28, marginBottom: 6 },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: RADIUS,
    backgroundColor: FIELD,
  },
  // A step not started yet is quieter, so the one in progress is the one
  // her eye lands on.
  stageWaiting: { opacity: 0.45 },
  stageMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: L.statement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageMarkDone: { backgroundColor: '#0B7A4B', borderColor: '#0B7A4B' },
  stageText: { flex: 1, color: INK },
  appMark: { width: 28, height: 28, borderRadius: 7 },
  appMonogram: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: L.recessed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  encryptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 24,
    padding: 14,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  encryptionText: { flex: 1, color: MUTED, lineHeight: 18 },
  imported: { color: INK, marginTop: 14, lineHeight: 18, textAlign: 'center' },
  readingCard: { marginTop: 24, backgroundColor: FIELD, borderRadius: RADIUS, paddingHorizontal: 14, paddingVertical: 12 },
  readingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  readingNote: { color: MUTED, marginTop: 10 },
  groupTitle: { color: MUTED, letterSpacing: 0.8, marginBottom: 2 },
  // A plain row, not a card each. Twelve cards on one screen is twelve
  // objects to separate; these are twelve items in one list.
  connect: { marginTop: 28 },
  choices: { marginTop: 20, gap: 8 },
  // Full width, 56pt, label left and the check right. A row list answers the
  // question "which one" where a wrapped row of pills asks it again.
  choice: {
    minHeight: 56,
    borderRadius: RADIUS,
    backgroundColor: FIELD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceOn: { backgroundColor: L.statement, borderColor: INK },
  title: { color: INK, letterSpacing: -0.4 },
  lede: { color: MUTED, marginTop: 16, lineHeight: 26 },
  quiet: { color: MUTED, marginTop: 14 },

  header: {
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Both sides reserve the same width so the dots stay centred on the screen
  // rather than centred on whatever is left over.
  headerSide: { width: 56, minHeight: 44, justifyContent: 'center' },
  headerLeft: { alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LINE },
  dotOn: { backgroundColor: INK },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: L.statement,
  },
  chipOn: { backgroundColor: INK, borderColor: INK },

  field: { marginTop: 28 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: { flex: 1, color: INK, backgroundColor: FIELD, borderRadius: RADIUS, paddingHorizontal: 14, height: 48 },
  add: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  ghost: {
    minHeight: 48,
    marginTop: 14,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: { borderWidth: 1, borderColor: LINE, borderRadius: RADIUS, padding: 16, marginTop: 12, gap: 6 },
  cardSub: { color: MUTED, lineHeight: 19 },

  actions: { marginTop: 40, gap: 12 },
  primary: { height: 52, borderRadius: RADIUS, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  error: { color: '#B3261E', marginTop: 14 },
});
