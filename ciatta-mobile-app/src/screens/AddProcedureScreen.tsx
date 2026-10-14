// Add a procedure with the day it happened. The date is what makes a
// before and after possible, so it is required; nothing is guessed.

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { dayFromParts } from '../lib/procedureEffect';
import { takePrefill } from '../lib/procedureHandoff';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { DetailScreen, SaveBar } from '../ui/kit';
import { L, SPACE } from '../ui/surface';

export function AddProcedureScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [name, setName] = useState(() => takePrefill() ?? '');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = dayFromParts(day, month, year);

  const save = async () => {
    if (!name.trim() || !date || saving) return;
    setSaving(true);
    setError(null);
    try {
      await repo.addProcedure({ id: `proc-${Date.now().toString(36)}`, name: name.trim(), date });
      nav.back();
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen title="Add a Procedure" onBack={nav.back} footer={<SaveBar label={saving ? 'Saving' : 'Save'} disabled={!name.trim() || !date || saving} onPress={save} />}>
      <Text style={[font('caption1'), a.label]}>What was done</Text>
      <TextInput value={name} onChangeText={setName} placeholder="For example, Laparoscopy" placeholderTextColor={L.meta} style={[font('body'), a.input]} accessibilityLabel="Procedure name" />
      <Text style={[font('caption1'), a.label]}>When</Text>
      <View style={a.dateRow}>
        <TextInput value={day} onChangeText={setDay} placeholder="Day" keyboardType="number-pad" maxLength={2} placeholderTextColor={L.meta} style={[font('body'), a.input, a.part]} accessibilityLabel="Day" />
        <TextInput value={month} onChangeText={setMonth} placeholder="Month" keyboardType="number-pad" maxLength={2} placeholderTextColor={L.meta} style={[font('body'), a.input, a.part]} accessibilityLabel="Month, as a number" />
        <TextInput value={year} onChangeText={setYear} placeholder="Year" keyboardType="number-pad" maxLength={4} placeholderTextColor={L.meta} style={[font('body'), a.input, a.part]} accessibilityLabel="Year" />
      </View>
      {day && month && year.length === 4 && !date ? (
        <Text style={[font('footnote'), a.note]}>That is not a date in the past. Check the day and month.</Text>
      ) : null}
      {error ? <Text style={[font('footnote'), a.note]}>{displayCopy(error)}</Text> : null}
    </DetailScreen>
  );
}

const a = StyleSheet.create({
  label: { color: L.meta, marginTop: SPACE.near, marginBottom: 6 },
  input: { color: L.ink, backgroundColor: L.recessed, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  dateRow: { flexDirection: 'row', gap: 8 },
  part: { flex: 1, textAlign: 'center' },
  note: { color: L.meta, marginTop: 8 },
});
