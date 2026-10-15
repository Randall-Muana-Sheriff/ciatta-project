// One referral: who to, why, who referred her, and the steps from referred
// to seen. Tapping a step marks it done today (or undoes it); the next step
// is written out for her to do. Ciatta never contacts anyone.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { takeReferral } from '../lib/agent/handoff';
import { displayCopy } from '../lib/displayCopy';
import { nextAction, REFERRAL_STEPS, type Referral, type StepKey } from '../lib/referrals';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { Icon } from '../ui/icons';
import { DetailScreen, SecondaryButton, SaveBar } from '../ui/kit';
import { L, SPACE, TILE_RADIUS, BLEED } from '../ui/surface';
import { CardFill } from '../ui/cardFill';
import { G } from '../ui/scheme';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shown = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export function ReferralScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [start] = useState(() => takeReferral());
  const [r, setR] = useState<Referral>(() => ({
    id: start.id ?? `ref-${Date.now().toString(36)}`,
    specialty: start.specialty ?? '',
    clinician: null,
    reason: null,
    referredBy: null,
    referredOn: null,
    steps: {},
    scheduledFor: null,
    notes: null,
  }));
  const [existing, setExisting] = useState(false);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [visit, setVisit] = useState({ day: '', month: '', year: '' });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    repo.loadInsurance().then((i) => setHasInsurance(!!i)).catch(() => {});
    if (!start.id) return;
    repo
      .loadReferrals()
      .then((list) => {
        const found = list.find((x) => x.id === start.id);
        if (found) {
          setR(found);
          setExisting(true);
        }
      })
      .catch(() => {});
  }, [repo, start.id]);

  const set = (patch: Partial<Referral>) => setR((x) => ({ ...x, ...patch }));
  const toggle = (key: StepKey) => {
    const steps = { ...r.steps };
    if (steps[key]) delete steps[key];
    else steps[key] = today();
    set({ steps });
  };
  // A visit date can be in the future, so it is read from the parts here
  // rather than through dayFromParts, which only accepts past days.
  const visitDay = (() => {
    const { day, month, year } = visit;
    if (!day || !month || year.length !== 4) return null;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.getDate() === Number(day) ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : null;
  })();

  const save = async () => {
    if (!r.specialty.trim() || saving) return;
    setSaving(true);
    setNote(null);
    try {
      const steps = { ...r.steps };
      if (!steps.referred) steps.referred = r.referredOn ?? today();
      await repo.saveReferral({ ...r, steps, scheduledFor: visitDay ?? r.scheduledFor });
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await repo.deleteReferral(r.id);
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'That did not save. Try again.'));
    }
  };

  const next = nextAction(r, hasInsurance);
  const field = (label: string, value: string | null, onChange: (v: string) => void, placeholder: string) => (
    <>
      <Text style={[font('caption1'), s.label]}>{label}</Text>
      <TextInput value={value ?? ''} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={G.meta} style={[font('body'), s.input]} accessibilityLabel={label} />
    </>
  );

  return (
    <DetailScreen title={existing ? r.specialty || 'Referral' : 'Track a Referral'} onBack={nav.back} footer={<SaveBar label={saving ? 'Saving' : 'Save'} disabled={!r.specialty.trim() || saving} onPress={() => void save()} />}>
      {field('Referred to', r.specialty, (v) => set({ specialty: v }), 'For example, Gynecology')}
      {field('Clinician or clinic', r.clinician, (v) => set({ clinician: v || null }), 'Optional')}
      {field('Why', r.reason, (v) => set({ reason: v || null }), 'For example, pelvic pain')}
      {field('Referred by', r.referredBy, (v) => set({ referredBy: v || null }), 'Optional')}

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>Steps</Eyebrow>
      </View>
      <View style={s.card}>
        <CardFill />
        {REFERRAL_STEPS.map((step, n) => {
          const done = r.steps[step.key];
          return (
            <Pressable
              key={step.key}
              onPress={() => toggle(step.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!done }}
              style={[s.step, n > 0 && s.divided]}
            >
              <View style={[s.tick, done && s.tickOn]}>{done ? <Icon name="check" size={14} color={L.onPill} /> : null}</View>
              <Text style={[font('subhead'), { color: L.ink, flex: 1 }]}>{step.label}</Text>
              <Text style={[font('caption1'), { color: L.meta }]}>{done ? shown(done) : 'Tap when done'}</Text>
            </Pressable>
          );
        })}
      </View>

      {r.steps.requested && !r.steps.seen ? (
        <>
          <Text style={[font('caption1'), s.label]}>{r.scheduledFor ? `Visit on ${shown(r.scheduledFor)}` : 'Visit date, when you have one'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['day', 'month', 'year'] as const).map((k) => (
              <TextInput
                key={k}
                value={visit[k]}
                onChangeText={(v) => setVisit((x) => ({ ...x, [k]: v }))}
                placeholder={k === 'day' ? 'Day' : k === 'month' ? 'Month' : 'Year'}
                keyboardType="number-pad"
                maxLength={k === 'year' ? 4 : 2}
                placeholderTextColor={L.meta}
                style={[font('body'), s.input, { flex: 1, textAlign: 'center' }]}
                accessibilityLabel={k}
              />
            ))}
          </View>
        </>
      ) : null}

      {next ? (
        <View style={[s.card, { marginTop: SPACE.block }]}>
          <CardFill />
          <Text style={[font('footnote', 'semibold'), { color: C.blueLink }]}>Next</Text>
          <Text style={[font('subhead'), { color: L.ink, marginTop: 4, lineHeight: 21 }]}>{displayCopy(next.text)}</Text>
        </View>
      ) : null}

      {field('Notes', r.notes, (v) => set({ notes: v || null }), 'What they said, what to bring')}

      <View style={{ marginTop: SPACE.block, gap: 12 }}>
        {existing ? <SecondaryButton label="Remove Referral" onPress={() => void remove()} /> : null}
      </View>
      {note ? <Text style={[font('footnote'), { color: G.meta, marginTop: 10 }]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  label: { color: G.meta, marginTop: SPACE.near, marginBottom: 6 },
  input: { color: G.ink, backgroundColor: G.fill, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, padding: 14, overflow: 'hidden', ...BLEED },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: L.meta, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: L.ink, borderColor: L.ink },
});
