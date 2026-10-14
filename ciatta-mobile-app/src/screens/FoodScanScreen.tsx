// A meal, read from her photo (design: ciatta-visual-assets/IMG_4911).
//
// The photo fills the width. Each food the scan found gets a dotted ring,
// a dot at its top and a frosted label with its name, where the model saw
// it. Beneath, Protein, Carbs and Fat, each with an arc: this meal's grams
// and its share of today, or, when she has set a target, what is left of
// it today. Every figure is an estimate and says so; tapping a food opens
// it to correct, and a corrected food is hers rather than the scan's.
//
// The photo is sent once to be read and is not kept anywhere but her
// phone. This is the one place Ciatta reads what is in a photo, and the
// screen says so.

import { GlassView } from 'expo-glass-effect';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Attachment } from '../lib/attachments';
import { displayCopy } from '../lib/displayCopy';
import { blankItem, editItem, type Meal, mealTotals, type ScanItem } from '../lib/foodScan';
import { macroGauge, type NutritionTargets } from '../lib/nutritionTargets';
import { takePhoto } from '../lib/scanHandoff';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font, numeral } from '../theme';
import { GLASS } from '../ui/glass';
import { DetailScreen, SecondaryButton, Tag, SaveBar } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { GlassFill } from '../ui/frosted';

type Phase = 'reading' | 'ready' | 'failed';

const id = () => `meal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const todayIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
};
const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function FoodScanScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [uri] = useState(() => takePhoto());
  const [phase, setPhase] = useState<Phase>('reading');
  const [items, setItems] = useState<ScanItem[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [ratio, setRatio] = useState(4 / 3);
  const [width, setWidth] = useState(0);
  const [targets, setTargets] = useState<NutritionTargets>({});
  const [earlier, setEarlier] = useState({ protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) {
      setPhase('failed');
      return;
    }
    Image.getSize(uri, (w, h) => h && setRatio(w / h), () => {});
    let ignore = false;
    (async () => {
      try {
        // 1024px on the long edge, so the photo is small to send and still
        // sharp enough to read.
        const ref = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
        const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
        const scan = await repo.scanFood(out.base64 ?? '');
        if (ignore) return;
        setItems(scan.items);
        setPhase(scan.notFood ? 'failed' : 'ready');
      } catch {
        if (!ignore) setPhase('failed');
      }
    })();
    repo.loadNutritionTargets().then((t) => !ignore && setTargets(t)).catch(() => {});
    repo
      .loadMeals(todayIso())
      .then((ms) => {
        if (ignore) return;
        const all = ms.flatMap((m) => m.items);
        setEarlier({
          protein_g: all.reduce((a, i) => a + i.protein_g, 0),
          carbs_g: all.reduce((a, i) => a + i.carbs_g, 0),
          fat_g: all.reduce((a, i) => a + i.fat_g, 0),
        });
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [uri, repo]);

  const totals = useMemo(() => mealTotals(items), [items]);
  const gauges = [
    macroGauge('Protein', totals.protein_g, targets.protein_g, earlier.protein_g + totals.protein_g),
    macroGauge('Carbs', totals.carbs_g, targets.carbs_g, earlier.carbs_g + totals.carbs_g),
    macroGauge('Fat', totals.fat_g, targets.fat_g, earlier.fat_g + totals.fat_g),
  ];

  const change = (n: number, patch: Partial<Omit<ScanItem, 'from' | 'at'>>) =>
    setItems((prev) => prev.map((it, i) => (i === n ? editItem(it, patch) : it)));

  const save = async () => {
    const kept = items.filter((i) => i.name.trim());
    if (!kept.length || saving) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const meal: Meal = { id: id(), eatenAt: now, items: kept, photoUri: uri };
      await repo.saveMeal(meal);
      // The foods reach her day, where the engine's food and bloating
      // check reads them, and the photo heads her Nutrition card.
      await repo.saveDailyLog({ day: dayKey(), foods: kept.map((i) => i.name) });
      const photo: Attachment[] = uri ? [{ id: meal.id, kind: 'photo', name: 'Meal photo', uri, addedAt: now }] : [];
      await repo.addJournal(kept.map((i) => i.name).join(', '), 'Context', photo, { category: 'nutrition', items: {} });
      nav.back();
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const W = width;
  const H = width / ratio;

  return (
    <DetailScreen
      title="Your Meal"
      onBack={nav.back}
      footer={
        phase === 'ready' ? (
          <SaveBar label={saving ? 'Saving' : 'Save Meal'} disabled={saving || !items.some((i) => i.name.trim())} onPress={save} />
        ) : undefined
      }
    >
      <View style={f.photoWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <GlassFill />
        {uri ? <Image source={{ uri }} style={{ width: W, height: H }} resizeMode="cover" accessibilityIgnoresInvertColors accessible={false} /> : null}

        {/* Rings, dots and labels, where the scan saw each food. */}
        {phase === 'ready' && W ? (
          <>
            <Svg style={StyleSheet.absoluteFill} width={W} height={H} pointerEvents="none">
              {items.map((it, n) =>
                it.at ? (
                  <Circle
                    key={`r${n}`}
                    cx={it.at.x * W}
                    cy={it.at.y * H}
                    r={it.at.r * W}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    strokeDasharray="0.5 5"
                    strokeLinecap="round"
                    fill="none"
                  />
                ) : null,
              )}
              {items.map((it, n) =>
                it.at ? <Circle key={`d${n}`} cx={it.at.x * W} cy={it.at.y * H - it.at.r * W} r={4} fill="#FFFFFF" /> : null,
              )}
            </Svg>
            {items.map((it, n) =>
              it.at ? (
                <Pressable
                  key={`l${n}`}
                  onPress={() => setOpen(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.name}, ${Math.round(it.kcal)} kilocalories, estimated. Edit`}
                  style={[f.labelSpot, { left: it.at.x * W - 90, top: Math.max(0, it.at.y * H - it.at.r * W - 44) }]}
                >
                  <Frost>
                    <Text style={[font('subhead'), f.labelText]} numberOfLines={1}>
                      {displayCopy(it.name)}
                    </Text>
                  </Frost>
                </Pressable>
              ) : null,
            )}
          </>
        ) : null}

        {phase === 'reading' ? (
          <View style={[StyleSheet.absoluteFill, f.veil]}>
            <Text style={[font('headline'), f.veilText]}>Reading your meal</Text>
          </View>
        ) : null}
      </View>

      {phase === 'failed' ? (
        <View style={f.block}>
          <Text style={[font('body'), f.body]}>Ciatta could not read a meal in this photo.</Text>
          <SecondaryButton
            label="Add Foods Yourself"
            onPress={() => {
              setItems([blankItem()]);
              setOpen(0);
              setPhase('ready');
            }}
          />
        </View>
      ) : null}

      {phase === 'ready' ? (
        <>
          {/* The three macro cards, as in the design. */}
          <View style={f.cards}>
            {gauges.map((g) => (
              <View key={g.caption} style={f.card} accessible accessibilityLabel={`${g.figure} ${g.caption}, estimated`}>
                <GlassFill />
                <Text style={[numeral(22), f.cardFigure]}>{g.figure}</Text>
                <Text style={[font('caption1'), f.cardCaption]} numberOfLines={1}>
                  {g.caption}
                </Text>
                <Arc fill={g.fill} />
              </View>
            ))}
          </View>
          <View style={f.estimateRow}>
            <Tag label="Estimated" tone="neutral" />
            <Text style={[font('footnote'), f.meta, { flex: 1 }]}>
              Estimates from your photo. Tap a food to correct it. {totals.kcal.toLocaleString('en-US')} kcal in this meal.
            </Text>
          </View>

          {/* Every food, editable. */}
          {items.map((it, n) => (
            <View key={n} style={f.item}>
              <Pressable onPress={() => setOpen(open === n ? null : n)} accessibilityRole="button" style={f.itemHead}>
                <Text style={[font('subhead', 'semibold'), f.body, { flex: 1 }]}>{it.name ? displayCopy(it.name) : 'New food'}</Text>
                <Text style={[font('footnote'), f.meta]}>
                  {Math.round(it.kcal)} kcal{it.from === 'estimated' ? ', estimated' : ''}
                </Text>
              </Pressable>
              {open === n ? (
                <View style={f.editor}>
                  <Field label="Food" value={it.name} onChange={(v) => change(n, { name: v })} />
                  <Field label="Portion" value={it.portion} onChange={(v) => change(n, { portion: v })} />
                  <View style={f.numbers}>
                    <NumberField label="kcal" value={it.kcal} onChange={(v) => change(n, { kcal: v })} />
                    <NumberField label="Protein g" value={it.protein_g} onChange={(v) => change(n, { protein_g: v })} />
                    <NumberField label="Carbs g" value={it.carbs_g} onChange={(v) => change(n, { carbs_g: v })} />
                    <NumberField label="Fat g" value={it.fat_g} onChange={(v) => change(n, { fat_g: v })} />
                  </View>
                  <Pressable
                    onPress={() => {
                      setItems((prev) => prev.filter((_, i) => i !== n));
                      setOpen(null);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={[font('footnote', 'semibold'), f.remove]}>Remove this food</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
          <View style={f.block}>
            <SecondaryButton
              label="Add a Food"
              onPress={() => {
                setItems((prev) => [...prev, blankItem()]);
                setOpen(items.length);
              }}
            />
            {error ? <Text style={[font('footnote'), f.body]}>{displayCopy(error)}</Text> : null}
            <Text style={[font('caption1'), f.meta]}>
              Your photo was read to find the foods and was not kept anywhere but this phone.
            </Text>
          </View>
        </>
      ) : null}
    </DetailScreen>
  );
}

// The frosted pill: real glass where the system has it, a translucent
// fill where it does not.
function Frost({ children }: { children: ReactNode }) {
  const Surface = GLASS ? GlassView : View;
  return <Surface style={[f.label, GLASS ? null : f.labelPainted]}>{children}</Surface>;
}

// The macro card's arc: a quarter circle track, filled to `fill`.
function Arc({ fill }: { fill: number }) {
  const size = 64;
  const r = 26;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const point = (t: number) => {
    const a = Math.PI + t * Math.PI;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const start = point(0);
  const end = point(1);
  const at = point(Math.max(0.001, Math.min(1, fill)));
  return (
    <Svg width={size} height={size / 2 + 10} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={`M${start.x},${start.y} A${r},${r} 0 0 1 ${end.x},${end.y}`} stroke={L.rule} strokeWidth={5} fill="none" strokeLinecap="round" />
      {fill > 0 ? (
        <Path d={`M${start.x},${start.y} A${r},${r} 0 0 1 ${at.x},${at.y}`} stroke="#6FB6F5" strokeWidth={5} fill="none" strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={f.field}>
      <Text style={[font('caption1'), f.meta]}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} style={[font('body'), f.input]} placeholderTextColor={L.meta} accessibilityLabel={label} />
    </View>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(Math.round(value * 10) / 10));
  return (
    <View style={f.numberField}>
      <Text style={[font('caption2'), f.meta]}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        keyboardType="decimal-pad"
        style={[font('body'), f.input]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const f = StyleSheet.create({
  photoWrap: { borderRadius: TILE_RADIUS, overflow: 'hidden', backgroundColor: L.glass, minHeight: 200 },
  labelSpot: { position: 'absolute', width: 180, alignItems: 'center' },
  label: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, overflow: 'hidden' },
  labelPainted: { backgroundColor: 'rgba(40, 44, 40, 0.55)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  labelText: { color: '#FFFFFF' },
  veil: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  veilText: { color: '#FFFFFF' },
  cards: { flexDirection: 'row', gap: 10, marginTop: SPACE.near },
  card: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    paddingTop: 14,
    gap: 2,
    overflow: 'hidden',
  },
  cardFigure: { color: L.ink },
  cardCaption: { color: L.meta, marginBottom: 6 },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACE.tight },
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: L.rule, paddingVertical: 12 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editor: { gap: 10, marginTop: 10 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { gap: 4 },
  numberField: { width: '47%', gap: 4 },
  input: { color: L.ink, backgroundColor: L.recessed, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  remove: { color: L.meta },
  block: { gap: SPACE.tight, marginTop: SPACE.block },
  body: { color: L.ink },
  meta: { color: L.meta, lineHeight: 18 },
});
