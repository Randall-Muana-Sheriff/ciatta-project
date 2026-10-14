// A clinician on her care team, as she entered them: name, role, where
// they practise, and how to reach them. From here she can have Ciatta
// draft a message to them, which she sends herself.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { type ClinicianRow, clinicianName, splitName } from '../lib/care';
import { openRequest, takeClinician } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { DetailScreen, SaveBar, SecondaryButton } from '../ui/kit';
import { L, SPACE } from '../ui/surface';

const blank = (): ClinicianRow => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  role: null,
  organization: null,
  phone: null,
  email: null,
  notes: null,
});

const FIELDS: { key: keyof ClinicianRow; label: string; placeholder: string; keyboard?: 'phone-pad' | 'email-address' }[] = [
  { key: 'role', label: 'Specialty', placeholder: 'For example, Gynecologist' },
  { key: 'organization', label: 'Where', placeholder: 'For example, Riverside Health' },
  { key: 'phone', label: 'Phone', placeholder: 'Optional', keyboard: 'phone-pad' },
  { key: 'email', label: 'Email', placeholder: 'Optional', keyboard: 'email-address' },
  { key: 'notes', label: 'Notes', placeholder: 'What they look after, how best to reach them' },
];

export function ClinicianScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [openId] = useState(() => takeClinician());
  const [c, setC] = useState<ClinicianRow>(blank);
  // First and last name, kept apart while she edits, joined when saved.
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!openId) return;
    repo
      .loadCareTeam()
      .then((rows) => {
        const found = rows.find((r) => r.id === openId);
        if (found) {
          setC(found);
          const n = splitName(found.name);
          setFirst(n.first);
          setLast(n.last);
        }
      })
      .catch(() => {});
  }, [repo, openId]);

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      await repo.saveClinician({ ...c, name: clinicianName(first, last) });
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
      await repo.deleteClinician(c.id);
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'That did not remove. Try again.'));
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title={openId ? clinicianName(first, last) || 'Clinician' : 'Add a Clinician'}
      onBack={nav.back}
      footer={<SaveBar label={saving ? 'Saving' : 'Save'} disabled={saving || !first.trim() || !last.trim()} onPress={() => void save()} />}
    >
      <View style={s.names}>
        <View style={{ flex: 1 }}>
          <Text style={[font('footnote'), s.label]}>First name</Text>
          <TextInput value={first} onChangeText={setFirst} placeholder="Maria" placeholderTextColor={L.meta} autoCapitalize="words" style={[font('body'), s.input]} accessibilityLabel="First name" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[font('footnote'), s.label]}>Last name</Text>
          <TextInput value={last} onChangeText={setLast} placeholder="Rivera" placeholderTextColor={L.meta} autoCapitalize="words" style={[font('body'), s.input]} accessibilityLabel="Last name" />
        </View>
      </View>
      {FIELDS.map((f) => (
        <View key={f.key}>
          <Text style={[font('footnote'), s.label]}>{f.label}</Text>
          <TextInput
            value={(c[f.key] as string | null) ?? ''}
            onChangeText={(v) => setC((x) => ({ ...x, [f.key]: v || null }))}
            placeholder={f.placeholder}
            placeholderTextColor={L.meta}
            keyboardType={f.keyboard}
            autoCapitalize={f.keyboard === 'email-address' ? 'none' : 'words'}
            multiline={f.key === 'notes'}
            style={[font('body'), s.input, f.key === 'notes' && { minHeight: 80 }]}
            accessibilityLabel={f.label}
          />
        </View>
      ))}

      {openId ? (
        <View style={{ marginTop: SPACE.block, gap: 12 }}>
          <SecondaryButton
            label="Draft a Message"
            onPress={() => {
              openRequest({ draft: { kind: 'question', clinician: clinicianName(first, last) } });
              nav.push('careRequest');
            }}
          />
          <SecondaryButton label="Remove From Care Team" onPress={() => void remove()} />
        </View>
      ) : null}
      {note ? <Text style={[font('footnote'), s.note]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  names: { flexDirection: 'row', gap: 10 },
  label: { color: L.meta, marginTop: SPACE.near, marginBottom: 6 },
  input: { color: L.ink, backgroundColor: L.recessed, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  note: { color: L.meta, marginTop: 10, lineHeight: 18 },
});
