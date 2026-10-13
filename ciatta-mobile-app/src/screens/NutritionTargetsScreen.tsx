// Her own daily nutrition targets. Every box is optional and starts empty:
// Ciatta never suggests a number. With a target set, the macro cards on a
// scanned meal count down what is left; without one, they show what she ate.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { type NutritionTargets, targetFromInput } from '../lib/nutritionTargets';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { DetailScreen, PrimaryButton } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';

const FIELDS: { key: keyof NutritionTargets; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
];

export function NutritionTargetsScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [text, setText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    repo
      .loadNutritionTargets()
      .then((t) => setText(Object.fromEntries(FIELDS.map((f) => [f.key, t[f.key] != null ? String(t[f.key]) : '']))))
      .catch(() => {});
  }, [repo]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next: NutritionTargets = {};
      for (const f of FIELDS) {
        const v = targetFromInput(text[f.key] ?? '');
        if (v != null) next[f.key] = v;
      }
      await repo.saveNutritionTargets(next);
      nav.back();
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen title="Nutrition Targets" onBack={nav.back}>
      <Text style={[font('subhead'), t.lede]}>
        Optional, and yours. Leave a box empty to see what you ate instead of what is left. A clinician or dietitian can help you choose.
      </Text>
      {FIELDS.map((f) => (
        <View key={f.key} style={t.row}>
          <Text style={[font('body'), t.label]}>{f.label}</Text>
          <TextInput
            value={text[f.key] ?? ''}
            onChangeText={(v) => setText((prev) => ({ ...prev, [f.key]: v }))}
            keyboardType="number-pad"
            placeholder="Not set"
            placeholderTextColor={L.meta}
            accessibilityLabel={`${f.label} target, ${f.unit} a day`}
            style={[font('body'), t.input]}
          />
          <Text style={[font('footnote'), t.unit]}>{f.unit} a day</Text>
        </View>
      ))}
      <View style={{ marginTop: SPACE.block }}>
        <PrimaryButton label={saving ? 'Saving' : 'Save'} disabled={saving} onPress={save} />
      </View>
      {error ? <Text style={[font('footnote'), t.error]}>{displayCopy(error)}</Text> : null}
    </DetailScreen>
  );
}

const t = StyleSheet.create({
  lede: { color: L.body, lineHeight: 22, marginBottom: SPACE.near },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: L.rule,
  },
  label: { color: L.ink, flex: 1 },
  input: {
    color: L.ink,
    minWidth: 90,
    textAlign: 'right',
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  unit: { color: L.meta, width: 64 },
  error: { color: L.ink, marginTop: 10 },
});
