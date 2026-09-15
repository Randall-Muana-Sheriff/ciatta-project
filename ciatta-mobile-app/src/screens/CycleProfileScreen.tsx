import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { addDays, daysBetween, isoDay, parseDay, startOfDay } from '../data/cycleLog';
import { CONTRACEPTION, type Contraception, type CycleProfile, fertilityOn, has, SITUATIONS, toggleSituation } from '../lib/cycleProfile';
import { displayCopy } from '../lib/displayCopy';
import { FERTILITY_DISCLAIMER } from '../lib/fertility';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { C, font } from '../theme';
import { ListGroup, ListRow } from '../ui/chrome';
import { ChoiceChips, FieldLabel, Stepper } from '../ui/cycleInputs';
import { DetailScreen, PrimaryButton } from '../ui/kit';

const weeksAgo = (iso: string | undefined, now: Date) => (iso ? Math.max(0, Math.round(daysBetween(parseDay(iso), now) / 7)) : null);
const weeksLabel = (n: number) => (n === 0 ? 'This week' : n === 1 ? '1 week ago' : `${n} weeks ago`);

// Your Cycle: every situation that fits, and the one or two details each needs.
export function CycleProfileScreen() {
  const nav = useNav();
  const { profile, setProfile } = useCycle();
  const [draft, setDraft] = useState<CycleProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const birth = weeksAgo(draft.birthDate, now);
  const last = weeksAgo(draft.lastPeriod, now);

  const setWeeks = (key: 'birthDate' | 'lastPeriod', n: number) =>
    setDraft((d) => ({ ...d, [key]: isoDay(addDays(startOfDay(now), -Math.max(0, n) * 7)) }));
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
      <Text style={[font('subhead'), { color: C.secondary, marginBottom: 16 }]}>
        Pick everything that fits. You can change this any time.
      </Text>
      <ListGroup>
        {SITUATIONS.map((s, n) => {
          const on = has(draft, s.id);
          return (
            <ListRow
              key={s.id}
              first={n === 0}
              title={s.id}
              sub={s.sub}
              onPress={() => setDraft((d) => toggleSituation(d, s.id))}
              selected={on}
            />
          );
        })}
      </ListGroup>

      {fertilityOn({ ...draft, showFertility: true }) ? (
        <View style={{ marginTop: 24 }}>
          <ListGroup header="Fertility" footer={displayCopy(FERTILITY_DISCLAIMER)}>
            <ListRow
              first
              title="Show Fertile Window"
              sub="Estimated from your periods, temperature and ovulation tests"
              right={
                <Switch
                  value={draft.showFertility !== false}
                  onValueChange={(on) => setDraft((d) => ({ ...d, showFertility: on }))}
                  trackColor={{ false: C.fill, true: C.green }}
                  ios_backgroundColor={C.fill}
                  accessibilityLabel="Show fertile window"
                />
              }
            />
          </ListGroup>
        </View>
      ) : null}

      {has(draft, 'Postpartum') ? (
        <>
          <FieldLabel>When did you give birth?</FieldLabel>
          <Stepper
            label="Birth"
            value={birth == null ? 'Not set' : weeksLabel(birth)}
            onEarlier={() => setWeeks('birthDate', (birth ?? -1) + 1)}
            onLater={() => setWeeks('birthDate', (birth ?? 1) - 1)}
            laterDisabled={birth == null || birth === 0}
          />
          <FieldLabel>Are you breastfeeding?</FieldLabel>
          <ChoiceChips
            single
            options={['Yes', 'No']}
            selected={draft.breastfeeding == null ? [] : [draft.breastfeeding ? 'Yes' : 'No']}
            onToggle={(v) => setDraft((d) => ({ ...d, breastfeeding: d.breastfeeding === (v === 'Yes') ? undefined : v === 'Yes' }))}
          />
        </>
      ) : null}

      {has(draft, 'Perimenopause') ? (
        <>
          <FieldLabel hint="Only used until you log a period here.">When was your last period?</FieldLabel>
          <Stepper
            label="Last period"
            value={last == null ? 'Not set' : weeksLabel(last)}
            onEarlier={() => setWeeks('lastPeriod', (last ?? -1) + 1)}
            onLater={() => setWeeks('lastPeriod', (last ?? 1) - 1)}
            laterDisabled={last == null || last === 0}
          />
        </>
      ) : null}

      {has(draft, 'Hormonal contraception') ? (
        <>
          <FieldLabel>Which kind?</FieldLabel>
          <ChoiceChips
            single
            options={CONTRACEPTION}
            selected={draft.contraception ? [draft.contraception] : []}
            onToggle={(v) => setDraft((d) => ({ ...d, contraception: d.contraception === v ? undefined : (v as Contraception) }))}
          />
        </>
      ) : null}
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
