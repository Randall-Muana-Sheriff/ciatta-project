import { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { connectAppleHealth } from '../lib/connectHealth';
import { useDictation } from '../lib/dictation';
import { displayCopy } from '../lib/displayCopy';
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
import { images } from '../ui/images';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

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

const INK = '#111113';
const MUTED = '#6B6B70';
const LINE = '#E4E4E7';
const FIELD = '#F5F5F7';

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
            <Text style={[font('subhead'), { color: on ? '#FFFFFF' : INK }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A free text list. Nobody's medication list is a multiple choice question.
function AddList({
  label,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
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
      <Text style={[font('subhead', 'semibold'), { color: INK }]}>{label}</Text>
      <View style={s.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          returnKeyType="done"
          style={[font('body'), s.input]}
          accessibilityLabel={label}
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
              <Text style={[font('subhead'), { color: '#FFFFFF' }]}>{x}</Text>
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
  const { userId, reloadFirstName } = useSession();
  const insets = useSafeAreaInsets();
  const [a, setA] = useState<Answers>(emptyAnswers());
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [sourceNote, setSourceNote] = useState('');

  const dictation = useDictation((text) => {
    setA((prev) => ({
      ...prev,
      opening: prev.opening.trim() ? `${prev.opening.trim()} ${text}` : text,
      openingMode: 'spoken',
    }));
  });

  const steps = useMemo(() => stepsFor(a), [a]);
  const step: StepId = steps[Math.min(i, steps.length - 1)];
  const paragraph = useMemo(() => reflectionParagraph(a), [a]);

  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));
  const next = () => setI((n) => Math.min(n + 1, steps.length - 1));
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
      await connectAppleHealth({
        userId,
        saveStatus: (kind, status, lastSyncedAt) => repo.saveSourceStatus(kind, status, lastSyncedAt),
        onNote: setSourceNote,
      });
    } catch {
      setSourceNote('That did not connect. You can try again from Profile.');
    } finally {
      setConnecting(false);
    }
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await repo.completeOnboarding(a);
      // The greeting reads the name she just set rather than the one the sign
      // in copied off her account.
      await reloadFirstName();
      onDone();
    } catch {
      // Her answers stay on screen. A failed save must not look like a
      // finished session, and must not throw away what she just typed.
      setError('That did not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // The welcome screen is its own layout, not a variant of the white one.
  // It is the only screen with a photograph behind it, and the photograph
  // runs from luminance 222 at the top to 41 at the bottom, so neither black
  // nor white text works across the whole of it. The gradient below lands it
  // dark enough for white type everywhere without flattening the picture
  // where nothing sits on top of it.
  if (step === 'welcome') {
    return (
      <View style={s.fill}>
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

        <View style={[s.welcomeTop, { paddingTop: insets.top + 24 }]} pointerEvents="none">
          <Image
            source={images.wordmark}
            style={s.logo}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Ciatta"
          />
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
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={[s.body, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Dots index={i - 1} total={steps.length - 1} />


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
            <TextInput
              value={a.opening}
              onChangeText={(t) => set({ opening: t, openingMode: 'typed' })}
              placeholder="However you would say it to a friend"
              placeholderTextColor={MUTED}
              multiline
              textAlignVertical="top"
              style={[font('body'), s.textarea]}
              accessibilityLabel="What has been changing"
            />
            {dictation.listening ? (
              <Text style={[font('body'), s.partial]}>{dictation.partial || 'Listening'}</Text>
            ) : null}
            <Pressable
              onPress={dictation.listening ? dictation.stop : dictation.start}
              accessibilityRole="button"
              style={({ pressed }) => [s.ghost, pressed && s.pressed]}
            >
              <Text style={[font('subhead', 'semibold'), { color: INK }]}>
                {dictation.listening ? 'Stop' : 'Speak instead'}
              </Text>
            </Pressable>
            {dictation.error ? (
              <Text style={[font('caption1'), s.quiet]} accessibilityLiveRegion="polite">
                {displayCopy(dictation.error)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 'snapshot' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              A quick picture of you
            </Text>

            <View style={s.field}>
              <Text style={[font('subhead', 'semibold'), { color: INK }]}>Your age</Text>
              <Chips
                options={AGE_RANGES.map((o) => o.label)}
                selected={a.ageRange ? [AGE_RANGES.find((o) => o.id === a.ageRange)?.label ?? ''] : []}
                onToggle={(label) => {
                  const id = AGE_RANGES.find((o) => o.label === label)?.id;
                  set({ ageRange: (a.ageRange === id ? null : id) as AgeRange | null });
                }}
              />
            </View>

            <View style={s.field}>
              <Text style={[font('subhead', 'semibold'), { color: INK }]}>Where you are now</Text>
              <Chips
                options={LIFE_STAGES.map((o) => o.label)}
                selected={a.lifeStage ? [LIFE_STAGES.find((o) => o.id === a.lifeStage)?.label ?? ''] : []}
                onToggle={(label) => {
                  const id = LIFE_STAGES.find((o) => o.label === label)?.id;
                  set({ lifeStage: (a.lifeStage === id ? null : id) as LifeStage | null });
                }}
              />
            </View>

            {/*
              A section, not a step. cycleIsRelevant still decides, so a woman
              in menopause never sees it, and the dots above do not change
              count when she picks that.
            */}
            {cycleIsRelevant(a) ? (
              <View style={s.field}>
                <Text style={[font('subhead', 'semibold'), { color: INK }]}>Your usual cycle</Text>
                <Chips
                  options={CYCLE_CHOICES}
                  selected={cycleChoice(a.cycleLength, a.cycleRegular)}
                  onToggle={(label) => set(cycleFromChoice(label, a))}
                />
              </View>
            ) : null}

            <View style={s.field}>
              <Text style={[font('subhead', 'semibold'), { color: INK }]}>What you have noticed</Text>
              <Chips
                options={SYMPTOMS}
                selected={a.symptoms}
                onToggle={(v) => set({ symptoms: toggle(a.symptoms, v) })}
              />
            </View>

            <AddList
              label="Diagnosed conditions"
              placeholder="Endometriosis, PCOS, thyroid"
              items={a.conditions}
              onChange={(conditions) => set({ conditions })}
            />
            <AddList
              label="Surgeries"
              placeholder="Laparoscopy"
              items={a.surgeries}
              onChange={(surgeries) => set({ surgeries })}
            />
            <AddList
              label="Medications"
              placeholder="Levothyroxine"
              items={a.medications}
              onChange={(medications) => set({ medications })}
            />
            <AddList
              label="Supplements"
              placeholder="Magnesium"
              items={a.supplements}
              onChange={(supplements) => set({ supplements })}
            />
            {/*
              goals was in the type from the first build and no screen ever
              set it, so the reflection line for it could never render. The
              spec asks for it; now something asks her.
            */}
            <AddList
              label="What you want to understand"
              placeholder="Why I am so tired"
              items={a.goals}
              onChange={(goals) => set({ goals })}
            />
          </View>
        ) : null}

        {step === 'connect' ? (
          <View>
            <Text style={[font('title1'), s.title]} accessibilityRole="header">
              Bring in what you already have
            </Text>

            <View style={s.card}>
              <Text style={[font('headline'), { color: INK }]}>Apple Health</Text>
              <Text style={[font('footnote'), s.cardSub]}>
                Sleep, steps and heart rate, measured rather than remembered. This is what lets Ciatta compare a week
                to your own usual.
              </Text>
              <Pressable
                onPress={onConnectHealth}
                accessibilityRole="button"
                style={({ pressed }) => [s.ghost, pressed && s.pressed]}
              >
                <Text style={[font('subhead', 'semibold'), { color: INK }]}>{connecting ? 'Connecting' : 'Connect'}</Text>
              </Pressable>
              {sourceNote ? (
                <Text style={[font('footnote'), s.cardSub]} accessibilityLiveRegion="polite">
                  {displayCopy(sourceNote)}
                </Text>
              ) : null}
            </View>
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
        <View style={s.actions}>
          {step === 'reflect' ? (
            <Pressable onPress={finish} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && s.pressed]}>
              <Text style={[font('headline'), { color: '#FFFFFF' }]}>{saving ? 'Saving' : 'Done'}</Text>
            </Pressable>
          ) : (
            <View style={s.pair}>
              <Pressable onPress={skip} accessibilityRole="button" style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
                <Text style={[font('headline'), { color: INK }]}>Skip</Text>
              </Pressable>
              <Pressable onPress={next} accessibilityRole="button" style={({ pressed }) => [s.primary, s.grow, pressed && s.pressed]}>
                <Text style={[font('headline'), { color: '#FFFFFF' }]}>Continue</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={back} accessibilityRole="button" style={({ pressed }) => [s.back, pressed && s.pressed]}>
            <Text style={[font('subhead'), { color: MUTED }]}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { paddingHorizontal: GUTTER, flexGrow: 1 },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  welcomeTop: { alignItems: 'center', paddingHorizontal: GUTTER },
  welcomeMid: { flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER },
  logo: { width: 74, height: 22 },
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
  title: { color: INK, letterSpacing: -0.4 },
  lede: { color: MUTED, marginTop: 16, lineHeight: 26 },
  quiet: { color: MUTED, marginTop: 14 },

  dots: { flexDirection: 'row', gap: 6, marginBottom: 36 },
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
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: INK, borderColor: INK },

  field: { marginTop: 28 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: { flex: 1, color: INK, backgroundColor: FIELD, borderRadius: RADIUS, paddingHorizontal: 14, height: 48 },
  add: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  textarea: { color: INK, backgroundColor: FIELD, borderRadius: RADIUS, padding: 16, minHeight: 148 },
  partial: { color: MUTED, marginTop: 12, fontStyle: 'italic' },
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
  pair: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  primary: { height: 52, borderRadius: RADIUS, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  // Same height and same type as Continue. Partial answers are a supported
  // way to use Ciatta, not a lesser one.
  secondary: {
    height: 52,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  back: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  error: { color: '#B3261E', marginTop: 14 },
});
