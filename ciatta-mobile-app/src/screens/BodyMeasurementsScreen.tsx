// Body measurements: her blood type (from Apple Health, or chosen), her
// height and weight in the units she reads them in (metric, US, or UK with
// stones), and those units for the whole app. Stored once in centimetres
// and kilograms; the conversions are in lib/units.ts and are tested.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { bloodTypeLabel } from '../lib/healthFacts';
import { askForCharacteristics } from '../lib/healthKit';
import type { BodyManual } from '../lib/overviewFacts';
import { defaultUnits, formatHeight, formatWeight, heightFromInput, type Units, weightFromInput } from '../lib/units';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, SecondaryButton, SegmentedControl, SaveBar } from '../ui/kit';
import { L, SPACE } from '../ui/surface';

const UNIT_SEGMENTS = ['Metric', 'US', 'UK'] as const;
const SEG_UNITS: Record<(typeof UNIT_SEGMENTS)[number], Units> = { Metric: 'metric', US: 'us', UK: 'uk' };
const CODES = [1, 2, 3, 4, 5, 6, 7, 8];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export function BodyMeasurementsScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [units, setUnits] = useState<Units>(() => defaultUnits(Intl.DateTimeFormat().resolvedOptions().locale));
  const [blood, setBlood] = useState<number | null>(null);
  const [h, setH] = useState({ cm: '', ft: '', in: '' });
  const [w, setW] = useState({ kg: '', lb: '', st: '' });
  const [saved, setSaved] = useState<BodyManual | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fields hold what she entered, written out in the units shown.
  const fill = (b: BodyManual | null, u: Units) => {
    if (b?.height_cm != null) {
      const inches = Math.round(b.height_cm / 2.54);
      setH({ cm: String(Math.round(b.height_cm)), ft: String(Math.floor(inches / 12)), in: String(inches % 12) });
    }
    if (b?.weight_kg != null) {
      const lb = round1(b.weight_kg * 2.20462);
      setW({ kg: String(round1(b.weight_kg)), lb: u === 'uk' ? String(round1(lb - Math.floor(lb / 14) * 14)) : String(lb), st: String(Math.floor(lb / 14)) });
    }
  };
  useEffect(() => {
    repo
      .loadBody()
      .then((b) => {
        setSaved(b);
        const u = b?.units ?? units;
        setUnits(u);
        setBlood(b?.blood_type ?? null);
        fill(b, u);
      })
      .catch(() => {});
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const heightCm = units === 'metric' ? heightFromInput({ cm: h.cm }) : heightFromInput({ ft: h.ft, in: h.in });
  const weightKg = units === 'metric' ? weightFromInput({ kg: w.kg }) : units === 'us' ? weightFromInput({ lb: w.lb }) : weightFromInput({ st: w.st, lb: w.lb });
  const heightTyped = units === 'metric' ? !!h.cm.trim() : !!(h.ft.trim() || h.in.trim());
  const weightTyped = units === 'metric' ? !!w.kg.trim() : units === 'us' ? !!w.lb.trim() : !!(w.st.trim() || w.lb.trim());

  const switchUnits = (u: Units) => {
    // Keep what she typed, written again in the new units.
    const next: BodyManual = { ...(heightCm != null ? { height_cm: heightCm } : {}), ...(weightKg != null ? { weight_kg: weightKg } : {}) };
    setUnits(u);
    fill(next, u);
  };

  const fromHealth = async () => {
    const t = await askForCharacteristics().catch(() => null);
    if (t?.bloodType) setBlood(t.bloodType);
    else setNote('Apple Health has no blood type for you. You can choose it here.');
  };

  const save = async () => {
    if ((heightTyped && heightCm == null) || (weightTyped && weightKg == null) || saving) return;
    setSaving(true);
    setNote(null);
    const weightChanged = weightKg != null && (saved?.weight_kg == null || Math.abs(saved.weight_kg - weightKg) >= 0.05);
    const next: BodyManual = {
      units,
      ...(blood ? { blood_type: blood } : {}),
      ...(heightCm != null ? { height_cm: round1(heightCm) } : {}),
      ...(weightKg != null ? { weight_kg: round1(weightKg), weight_on: weightChanged ? today() : (saved?.weight_on ?? today()) } : {}),
    };
    try {
      await repo.saveBody(next);
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const input = (value: string, onChange: (v: string) => void, label: string, flex = 1) => (
    <View style={{ flex }}>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={label} placeholderTextColor={L.meta} style={[font('body'), s.input]} accessibilityLabel={label} />
    </View>
  );

  return (
    <DetailScreen title="Body Measurements" onBack={nav.back} footer={<SaveBar label={saving ? 'Saving' : 'Save'} disabled={saving || (heightTyped && heightCm == null) || (weightTyped && weightKg == null)} onPress={() => void save()} />}>
      <Eyebrow>Units</Eyebrow>
      <View style={{ marginTop: SPACE.tight }}>
        <SegmentedControl segments={UNIT_SEGMENTS} active={UNIT_SEGMENTS.find((x) => SEG_UNITS[x] === units)!} onChange={(x) => switchUnits(SEG_UNITS[x])} />
      </View>
      <Text style={[font('caption1'), s.meta]}>Every height and weight in Ciatta is shown this way.</Text>

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>Blood type</Eyebrow>
      </View>
      <View style={s.chips}>
        {CODES.map((c) => {
          const on = blood === c;
          return (
            <Pressable key={c} onPress={() => setBlood(on ? null : c)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.chip, on && s.chipOn]}>
              <Text style={[font('footnote', on ? 'semibold' : 'regular'), { color: on ? L.ink : L.body }]}>{bloodTypeLabel(c)}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: SPACE.tight }}>
        <SecondaryButton label="From Apple Health" onPress={() => void fromHealth()} />
      </View>

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>Height</Eyebrow>
      </View>
      <View style={s.row}>
        {units === 'metric' ? (
          input(h.cm, (v) => setH({ ...h, cm: v }), 'Centimetres')
        ) : (
          <>
            {input(h.ft, (v) => setH({ ...h, ft: v }), 'Feet')}
            {input(h.in, (v) => setH({ ...h, in: v }), 'Inches')}
          </>
        )}
      </View>
      <Text style={[font('caption1'), s.meta]}>
        {heightTyped && heightCm == null ? 'That is not a height. Check the numbers.' : heightCm != null ? formatHeight(heightCm, units).other : ' '}
      </Text>

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>Weight</Eyebrow>
      </View>
      <View style={s.row}>
        {units === 'metric' ? input(w.kg, (v) => setW({ ...w, kg: v }), 'Kilograms') : null}
        {units === 'us' ? input(w.lb, (v) => setW({ ...w, lb: v }), 'Pounds') : null}
        {units === 'uk' ? (
          <>
            {input(w.st, (v) => setW({ ...w, st: v }), 'Stones')}
            {input(w.lb, (v) => setW({ ...w, lb: v }), 'Pounds')}
          </>
        ) : null}
      </View>
      <Text style={[font('caption1'), s.meta]}>
        {weightTyped && weightKg == null ? 'That is not a weight. Check the numbers.' : weightKg != null ? formatWeight(weightKg, units).other : ' '}
      </Text>
      <Text style={[font('footnote'), s.meta]}>
        Height and blood type you enter are used over Apple Health. For weight, the newer of the two is used.
      </Text>

      {note ? <Text style={[font('footnote'), s.meta]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  meta: { color: L.meta, marginTop: 6, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10, marginTop: SPACE.tight },
  input: { color: L.ink, backgroundColor: L.recessed, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACE.tight },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: L.recessed, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule },
  chipOn: { backgroundColor: L.fillSelected, borderColor: L.edgeOn },
});
