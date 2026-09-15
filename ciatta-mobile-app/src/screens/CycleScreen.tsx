import { StyleSheet, Text, View } from 'react-native';

import { daysBetween } from '../data/cycleLog';
import { tally } from '../lib/cyclePatterns';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { C, font, RADIUS } from '../theme';
import { ListGroup, ListRow, Panel } from '../ui/chrome';
import { ObservationCard } from '../ui/cycleInputs';
import { DetailScreen, PrimaryButton, SecLabel, SecondaryButton, SourceFooter } from '../ui/kit';

// Cycle home: timing, then what the cycle felt like, then how it's changing.
export function CycleScreen() {
  const nav = useNav();
  const { startDraft } = useCycle();
  const { signals, summaries, observations, template } = useCycleInsights();

  const current = summaries[summaries.length - 1];
  const lengths = summaries.map((c) => c.window.length).filter((n): n is number => n != null);
  const last4 = summaries.slice(-4);
  const mine = signals.filter((s) => s.cycle === current.window);
  const pain = mine.filter((s) => s.pain);
  const top = (lists: string[][], n: number) => tally(lists).slice(0, n).map((x) => x.label);

  const locations = top(pain.map((s) => s.episode.locations), 2);
  const sensations = top(pain.map((s) => s.episode.sensations), 2);
  const symptoms = top(mine.map((s) => s.episode.symptoms), 3);
  const overallLocations = top(signals.filter((s) => s.pain).map((s) => s.episode.locations), 3);
  const flares = mine.filter((s) => s.episode.flareUpUserReported).length;

  const log = () => {
    startDraft();
    nav.push('cycleLog');
  };
  const similar = () => {
    if (!template) return;
    startDraft({ mode: 'similar', form: template });
    nav.push('cycleLog');
  };
  const history = () => nav.push('cycleHistory');

  return (
    <DetailScreen
      title="Cycle"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="Pain, symptoms, and flare ups are what you reported." />}
    >
      <View style={cy.tiles}>
        <View style={cy.tile}>
          <Text style={[font('footnote'), { color: C.secondary }]}>Current cycle</Text>
          <Text style={[font('title2', 'semibold'), { color: C.text }]}>Day {daysBetween(current.window.start, new Date()) + 1}</Text>
          <Text style={[font('footnote'), { color: C.secondary }]}>Last cycle {lengths[lengths.length - 1]} days</Text>
        </View>
        <View style={cy.tile}>
          <Text style={[font('footnote'), { color: C.secondary }]}>Recent range</Text>
          <Text style={[font('title2', 'semibold'), { color: C.text }]}>
            {Math.min(...lengths)} to {Math.max(...lengths)} days
          </Text>
          <Text style={[font('footnote'), { color: C.secondary }]}>Last {lengths.length} cycles</Text>
        </View>
      </View>

      <PrimaryButton label="Log Cycle Experience" onPress={log} />

      {template ? (
        <Panel style={cy.gap}>
          <Text style={[font('headline'), { color: C.text }]}>Pain again?</Text>
          <Text style={[font('subhead'), { color: C.secondary, marginTop: 4 }]}>
            Your usual details are filled in, so you only add what changed.
          </Text>
          <View style={{ marginTop: 12 }}>
            <SecondaryButton label="Log Similar Episode" onPress={similar} />
          </View>
        </Panel>
      ) : null}

      <View style={cy.section}>
        <SecLabel>Your Experience</SecLabel>
        <ListGroup>
          <ListRow first icon="wave" tint={C.coral} title="Pain" sub={`${current.painDays} days this cycle`} onPress={history} />
          <ListRow icon="body" tint={C.coral} title="Most reported" sub={locations.join(' · ') || 'Nothing logged yet'} onPress={history} />
          <ListRow icon="target" tint={C.indigo} title="Common sensations" sub={sensations.join(' · ') || 'Nothing logged yet'} onPress={history} />
          <ListRow icon="triangle" tint={C.violet} title="Symptoms" sub={symptoms.join(' · ') || 'Nothing logged yet'} onPress={history} />
          <ListRow icon="flame" tint={C.coral} title="Flare ups" sub={flares ? `${flares} reported by you` : 'None reported'} onPress={history} />
        </ListGroup>
      </View>

      <View style={cy.section}>
        <SecLabel>Over Time</SecLabel>
        <ListGroup>
          <ListRow first title="Cycle length" sub={`${lengths.slice(-4).join(' → ')} days`} />
          <ListRow title="Pain days" sub={last4.map((c) => c.painDays).join(' → ')} />
          <ListRow title="Pain locations" sub={overallLocations.join(' · ')} />
        </ListGroup>
      </View>

      {observations.length ? (
        <View style={cy.section}>
          <SecLabel>Patterns</SecLabel>
          {observations.map((o) => (
            <ObservationCard key={o.id} observation={o} />
          ))}
        </View>
      ) : null}

      <View style={[cy.section, { gap: 12 }]}>
        <SecondaryButton label="Pain & Flare History" onPress={history} />
        <SecondaryButton label="View Cycle Journey" onPress={() => nav.goTab('journey')} />
      </View>
    </DetailScreen>
  );
}

const cy = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tile: { flex: 1, backgroundColor: C.card, borderRadius: RADIUS, padding: 14, gap: 2 },
  gap: { marginTop: 16 },
  section: { marginTop: 28 },
});
