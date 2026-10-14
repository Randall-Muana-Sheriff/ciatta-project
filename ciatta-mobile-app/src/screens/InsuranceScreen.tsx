// Her health insurance, entered by her: the insurer, the plan, and the
// member ID if she wants it kept with her record. Shown on her Profile
// overview as the insurer and plan; the member ID is only ever shown by its
// last four.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { insuranceFromInput, maskedMemberId } from '../lib/insurance';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { DetailScreen, SecondaryButton, SaveBar } from '../ui/kit';
import { L, SPACE } from '../ui/surface';

export function InsuranceScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [provider, setProvider] = useState('');
  const [plan, setPlan] = useState('');
  const [memberId, setMemberId] = useState('');
  const [had, setHad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    repo
      .loadInsurance()
      .then((ins) => {
        if (!ins) return;
        setHad(true);
        setProvider(ins.provider);
        setPlan(ins.plan ?? '');
        setMemberId(ins.member_id ?? '');
      })
      .catch(() => {});
  }, [repo]);

  const save = async () => {
    const next = insuranceFromInput({ provider, plan, memberId });
    if ('error' in next) {
      setNote(next.error);
      return;
    }
    setSaving(true);
    setNote(null);
    try {
      await repo.saveInsurance(next);
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await repo.saveInsurance(null);
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const masked = maskedMemberId(memberId.trim() || undefined);

  return (
    <DetailScreen title="Insurance" onBack={nav.back} footer={<SaveBar label={saving ? 'Saving' : 'Save'} disabled={saving || !provider.trim()} onPress={() => void save()} />}>
      <Text style={[font('caption1'), s.label]}>Insurer</Text>
      <TextInput value={provider} onChangeText={setProvider} placeholder="For example, Anthem" placeholderTextColor={L.meta} style={[font('body'), s.input]} accessibilityLabel="Insurer" autoCapitalize="words" />
      <Text style={[font('caption1'), s.label]}>Plan</Text>
      <TextInput value={plan} onChangeText={setPlan} placeholder="For example, PPO" placeholderTextColor={L.meta} style={[font('body'), s.input]} accessibilityLabel="Plan" />
      <Text style={[font('caption1'), s.label]}>Member ID</Text>
      <TextInput
        value={memberId}
        onChangeText={setMemberId}
        placeholder="Optional"
        placeholderTextColor={L.meta}
        style={[font('body'), s.input]}
        accessibilityLabel="Member ID, optional"
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Text style={[font('footnote'), s.note]}>
        {displayCopy(
          `Kept with your record and seen only by you.${masked ? ` On your Profile it shows as ${masked.toLowerCase()}.` : ' Your Profile shows the insurer and plan.'}`,
        )}
      </Text>
      <View style={{ marginTop: SPACE.block, gap: 12 }}>
        {had ? <SecondaryButton label="Remove Insurance" onPress={() => void remove()} /> : null}
      </View>
      {note ? <Text style={[font('footnote'), s.note]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  label: { color: L.meta, marginTop: SPACE.near, marginBottom: 6 },
  input: { color: L.ink, backgroundColor: L.recessed, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  note: { color: L.meta, marginTop: 10, lineHeight: 18 },
});
