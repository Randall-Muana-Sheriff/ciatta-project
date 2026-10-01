import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CycleProfile } from '../lib/cycleProfile';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { C, font } from '../theme';
import { CycleProfileForm } from '../ui/CycleProfileForm';
import { DetailScreen, PrimaryButton } from '../ui/kit';

// Your Cycle: the form (src/ui/CycleProfileForm.tsx) with its own save.
export function CycleProfileScreen() {
  const nav = useNav();
  const { profile, setProfile } = useCycle();
  const [draft, setDraft] = useState<CycleProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only leave once the change is actually kept. A save that failed used to
  // look applied and then come back undone on the next launch.
  const save = () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setProfile({ ...draft, setupDone: true }, (e) => {
      setSaving(false);
      if (e) setError(userFacingError(e, 'That did not save. Try again.'));
      else nav.back();
    });
  };

  return (
    <DetailScreen
      title="Your Cycle"
      onBack={nav.back}
      footer={
        <View style={p.footer}>
          {error ? <Text style={[font('footnote'), { color: C.tint, marginBottom: 8 }]}>{error}</Text> : null}
          <PrimaryButton label="Save" onPress={save} disabled={saving} />
        </View>
      }
    >
      <CycleProfileForm draft={draft} setDraft={setDraft} />
    </DetailScreen>
  );
}

const p = StyleSheet.create({
  footer: {
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },
});
