// Logging a day: what she ate, how her gut was, what she took in, and how
// it felt.
//
// One screen rather than four, because these are one act. A woman who has
// just eaten and felt bloated should not have to visit a food screen and
// a gut screen to say so, and the engine's most useful finding needs both
// halves recorded on the same day to see them together.
//
// Everything that decides anything is in lib/dailyLog and is tested. This
// renders, and the one rule it carries on its own is the calorie one:
// every figure reaches the screen through kcalLine or kcalTotalLine,
// which return null rather than a bare number, so there is no path by
// which an estimate renders as a measurement.

import { useCallback, useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CHECK_INS,
  dailyLogPatch,
  type CheckInKey,
  DIGESTION_FLAGS,
  emptyLog,
  type FoodEntry,
  hasAnything,
  kcalLine,
  kcalTotalLine,
  logLine,
} from '../lib/dailyLog';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { Composer } from '../ui/composer';
import { Icon } from '../ui/icons';
import { DetailScreen, PrimaryButton, Lead } from '../ui/kit';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
import { CardFill } from '../ui/cardFill';
import { G } from '../ui/scheme';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function DailyLogScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState(() => emptyLog(today()));
  const [draft, setDraft] = useState('');
  const [kcalDraft, setKcalDraft] = useState('');

  const set = <K extends keyof typeof log>(key: K, value: (typeof log)[K]) =>
    setLog((prev) => ({ ...prev, [key]: value }));

  const addFood = useCallback(() => {
    const name = draft.trim();
    if (!name) return;
    const typed = Number(kcalDraft.trim());
    const kcal = kcalDraft.trim() && Number.isFinite(typed) && typed > 0 ? typed : null;
    setLog((prev) => ({
      ...prev,
      foods: [
        ...prev.foods,
        {
          id: id(),
          name,
          kcal,
          // Typed by her off a label, so it is reported. Nothing on this
          // screen estimates: when a model is wired in later it sets
          // 'estimated' and the copy changes itself.
          kcalFrom: kcal == null ? null : 'reported',
          at: new Date().toISOString(),
          photoUri: null,
        } as FoodEntry,
      ],
    }));
    setDraft('');
    setKcalDraft('');
  }, [draft, kcalDraft]);

  const totalLine = useMemo(() => kcalTotalLine(log.foods), [log.foods]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const step = (value: number | null, by: number) => Math.max(0, (value ?? 0) + by);

  return (
    <DetailScreen
      title="Log your day"
      onBack={nav.back}
      footer={
        <View style={s.footer}>
          <PrimaryButton
            label={saving ? 'Saving' : 'Save today'}
            disabled={!hasAnything(log) || saving}
            onPress={async () => {
              setSaving(true);
              setError(null);
              try {
                await repo.saveDailyLog(dailyLogPatch(log));
                // Files go where she can see them again: a journal entry
                // filed under Nutrition.
                if (log.attachments.length) {
                  await repo.addJournal('', 'Context', log.attachments, {
                    category: 'nutrition',
                    items: log.digestion.length ? { gut: [...log.digestion] } : {},
                  });
                }
                nav.back();
              } catch (e) {
                setError(userFacingError(e, 'That did not save. Try again.'));
              } finally {
                setSaving(false);
              }
            }}
          />
          {error ? <Text style={[font('footnote'), { color: G.ink, marginTop: 10 }]}>{displayCopy(error)}</Text> : null}
        </View>
      }
    >
      <Lead style={s.lede} text={displayCopy(logLine(log))} />

      {/* ── In her own words, first ──────────────────────────
          The day starts where she would start: saying it. The same box
          as everywhere else, with the mic in its corner and the camera,
          images, a PDF and a video behind its plus. The sections below
          are for the parts she wants to tap rather than say. */}
      <View style={s.section}>
        <Eyebrow>Tell us about today</Eyebrow>
        <Text style={[font('caption1'), s.note]}>Say it, type it, or add a photo, image, PDF or video.</Text>
        <View style={{ marginTop: 10 }}>
          <Composer
            value={log.note}
            onChange={(v) => set('note', v)}
            placeholder="However you would say it"
            label="Tell us about today"
            attachments={log.attachments}
            onAttachments={(next) => set('attachments', next)}
            // Saved with the rest of the day by Save today, so send only
            // puts the keyboard away.
            onSend={() => Keyboard.dismiss()}
          />
        </View>
      </View>

      {/* ── Food ─────────────────────────────────────────────── */}
      <View style={s.section}>
        <Eyebrow>What you ate</Eyebrow>
        <Text style={[font('caption1'), s.note]}>
          In your words. Ciatta matches what you write against how you feel, so there is nothing to look up.
        </Text>

        <View style={s.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Porridge with berries"
            placeholderTextColor={G.meta}
            style={[font('body'), s.foodInput]}
            onSubmitEditing={addFood}
            returnKeyType="done"
            accessibilityLabel="What you ate"
          />
          <TextInput
            value={kcalDraft}
            onChangeText={setKcalDraft}
            placeholder="kcal"
            placeholderTextColor={G.meta}
            keyboardType="number-pad"
            style={[font('body'), s.kcalInput]}
            accessibilityLabel="Calories from the label, if you have it"
          />
          <Pressable
            onPress={addFood}
            accessibilityRole="button"
            accessibilityLabel="Add"
            style={({ pressed }) => [s.add, pressed && s.pressed]}
          >
            <Icon name="plus" size={20} color={G.onPill} />
          </Pressable>
        </View>
        <Text style={[font('caption2'), s.note]}>The calorie box is optional, and only for a figure you can read.</Text>

        {log.foods.length ? (
          <View style={s.card}>
            <CardFill />
            {log.foods.map((f, n) => {
              // Null rather than a bare number, which is the guarantee.
              const line = kcalLine(f);
              return (
                <View key={f.id} style={[s.row, n > 0 && s.divided]}>
                  <Text style={[font('subhead'), s.name]}>{displayCopy(f.name)}</Text>
                  {line ? <Text style={[font('caption1'), s.estimate]}>{displayCopy(line)}</Text> : null}
                  <Pressable
                    onPress={() => set('foods', log.foods.filter((x) => x.id !== f.id))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${f.name}`}
                    hitSlop={8}
                  >
                    <Icon name="xmark" size={14} color={L.meta} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
        {totalLine ? <Text style={[font('caption1'), s.total]}>{displayCopy(totalLine)}</Text> : null}
      </View>

      {/* ── Gut ──────────────────────────────────────────────── */}
      <View style={s.section}>
        <Eyebrow>Your gut</Eyebrow>
        {/* Stool is logged once, under Gut on the Log screen,
            as the bowel movement entry the body map reads. */}
        <Chips
          options={DIGESTION_FLAGS}
          selected={log.digestion}
          onToggle={(v) => set('digestion', toggle(log.digestion, v))}
        />
      </View>

      {/* ── Intake ───────────────────────────────────────────── */}
      <View style={s.section}>
        <Eyebrow>Caffeine and alcohol</Eyebrow>
        <Counter label="Caffeine" value={log.caffeine} onChange={(by) => set('caffeine', step(log.caffeine, by))} onClear={() => set('caffeine', null)} />
        <Counter label="Alcohol" value={log.alcohol} onChange={(by) => set('alcohol', step(log.alcohol, by))} onClear={() => set('alcohol', null)} />
      </View>

      {/* ── How it felt ──────────────────────────────────────── */}
      <View style={s.section}>
        <Eyebrow>How the day felt</Eyebrow>
        {CHECK_INS.map((c) => (
          <Scale
            key={c.key}
            question={c.question}
            value={log[c.key as CheckInKey]}
            onChange={(v) => set(c.key as CheckInKey, log[c.key as CheckInKey] === v ? null : v)}
          />
        ))}
      </View>

    </DetailScreen>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: readonly string[];
  onToggle: (v: string) => void;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => onToggle(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.pressed]}
          >
            <Text style={[font('subhead'), on ? s.nameOn : s.name]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A count she sets, which starts absent and can go back to absent.
// Clearing matters: no caffeine logged is not zero coffees.
function Counter({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: number | null;
  onChange: (by: number) => void;
  onClear: () => void;
}) {
  return (
    <View style={s.counter}>
      <Text style={[font('subhead'), s.name]}>{label}</Text>
      <View style={s.counterRight}>
        {value != null ? (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel={`Clear ${label}`} hitSlop={8}>
            <Text style={[font('caption1'), s.clear]}>Clear</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onChange(-1)}
          accessibilityRole="button"
          accessibilityLabel={`One less ${label}`}
          hitSlop={8}
          style={({ pressed }) => [s.stepper, pressed && s.pressed]}
        >
          <Icon name="minus" size={16} color={G.body} />
        </Pressable>
        <Text style={[font('headline'), value == null ? s.none : s.nameOn]}>{value == null ? 'Not set' : value}</Text>
        <Pressable
          onPress={() => onChange(1)}
          accessibilityRole="button"
          accessibilityLabel={`One more ${label}`}
          hitSlop={8}
          style={({ pressed }) => [s.stepper, pressed && s.pressed]}
        >
          <Icon name="plus" size={16} color={G.body} />
        </Pressable>
      </View>
    </View>
  );
}

// One to five, and the number is the answer. Never relabelled good or
// poor: she chose a number, and naming it for her is an interpretation.
function Scale({
  question,
  value,
  onChange,
}: {
  question: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={s.scale}>
      <Text style={[font('subhead'), s.name]}>{question}</Text>
      <View style={s.scaleRow}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${n} of 5`}
              style={({ pressed }) => [s.dot, on && s.dotOn, pressed && s.pressed]}
            >
              <Text style={[font('subhead', on ? 'semibold' : 'regular'), on ? s.nameOn : s.name]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  lede: { color: G.ink, lineHeight: 24, paddingHorizontal: GUTTER },
  note: { color: G.meta, lineHeight: 18, marginTop: 6 },
  sub: { color: L.body, marginTop: SPACE.near },
  section: { marginTop: SPACE.block, paddingHorizontal: GUTTER },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  foodInput: {
    flex: 1,
    color: G.ink,
    backgroundColor: G.fill,
    borderRadius: 12,
    borderWidth: st,
    borderColor: G.rule,
    paddingHorizontal: 14,
    height: 48,
  },
  kcalInput: {
    width: 74,
    color: G.ink,
    backgroundColor: G.fill,
    borderRadius: 12,
    borderWidth: st,
    borderColor: G.rule,
    paddingHorizontal: 10,
    height: 48,
    textAlign: 'center',
  },
  add: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: G.ink },

  card: {
    marginTop: 12,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divided: { borderTopWidth: st, borderTopColor: L.rule },
  name: { color: L.body, flex: 1 },
  nameOn: { color: G.ink, flex: 1 },
  // An estimate is drawn in Uncertainty, which is the system's hue for a
  // gap, so it never looks like a measured figure even at a glance.
  estimate: { color: HUE.uncertainty },
  total: { color: G.meta, marginTop: 10, lineHeight: 18 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: L.recessed,
  },
  chipOn: { backgroundColor: G.fillSelected, borderColor: G.rule },

  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  counterRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.recessed,
    borderWidth: st,
    borderColor: L.rule,
  },
  clear: { color: G.meta },
  none: { color: G.meta },

  scale: { marginTop: SPACE.near },
  scaleRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dot: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.recessed,
    borderWidth: st,
    borderColor: L.rule,
  },
  dotOn: { backgroundColor: G.fillSelected, borderColor: G.rule },

  footer: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 8 },
  pressed: { opacity: 0.55 },
});
