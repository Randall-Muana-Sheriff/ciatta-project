import { Switch, Text, View } from 'react-native';

import { addDays, daysBetween, isoDay, parseDay, startOfDay } from '../data/cycleLog';
import { CONTRACEPTION, type Contraception, type CycleProfile, fertilityOn, has, SITUATIONS, toggleSituation } from '../lib/cycleProfile';
import { displayCopy } from '../lib/displayCopy';
import { FERTILITY_DISCLAIMER } from '../lib/fertility';
import { C, font } from '../theme';
import { ListGroup, ListRow } from './chrome';
import { ChoiceChips, FieldLabel, Stepper } from './cycleInputs';

const weeksAgo = (iso: string | undefined, now: Date) => (iso ? Math.max(0, Math.round(daysBetween(parseDay(iso), now) / 7)) : null);
const weeksLabel = (n: number) => (n === 0 ? 'This week' : n === 1 ? '1 week ago' : `${n} weeks ago`);

// Your Cycle: every situation that fits, and the one or two details each
// needs. The form only; the Your Cycle screen and the first steps each
// wrap it with their own save.
export function CycleProfileForm({ draft, setDraft }: { draft: CycleProfile; setDraft: (update: (d: CycleProfile) => CycleProfile) => void }) {
  const now = new Date();
  const birth = weeksAgo(draft.birthDate, now);
  const last = weeksAgo(draft.lastPeriod, now);
  const setWeeks = (key: 'birthDate' | 'lastPeriod', n: number) =>
    setDraft((d) => ({ ...d, [key]: isoDay(addDays(startOfDay(now), -Math.max(0, n) * 7)) }));

  return (
    <>
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
    </>
  );
}
