import { Pressable, StyleSheet, Text, View } from 'react-native';

import { painSplit, tally } from '../lib/cyclePatterns';
import { displayCopy } from '../lib/displayCopy';
import { FERTILITY_DISCLAIMER, fmtRange } from '../lib/fertility';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { C, font, RADIUS } from '../theme';
import { ListGroup, ListRow, Panel } from '../ui/chrome';
import { ObservationCard } from '../ui/cycleInputs';
import { DetailScreen, PrimaryButton, SecLabel, SecondaryButton, SourceFooter, Tag } from '../ui/kit';
import { FertilityStrip, LengthDots, MonthsSince, PostpartumTimeline } from '../ui/lineCharts';

// Cycle home: timing, then what the cycle felt like, then how it's changing.
export function CycleScreen() {
  const nav = useNav();
  const { startDraft } = useCycle();
  const { signals, summaries, observations, template, lens, profile, fertility } = useCycleInsights();

  const current = summaries[summaries.length - 1] ?? null;
  const last4 = summaries.slice(-4);
  const mine = current ? signals.filter((s) => s.cycle === current.window) : [];
  const pain = mine.filter((s) => s.pain);
  const top = (lists: string[][], n: number) => tally(lists).slice(0, n).map((x) => x.label);

  const locations = top(pain.map((s) => s.episode.locations), 2);
  const sensations = top(pain.map((s) => s.episode.sensations), 2);
  const symptoms = top(mine.map((s) => s.episode.symptoms), 3);
  const overallLocations = top(signals.filter((s) => s.pain).map((s) => s.episode.locations), 3);
  const flares = mine.filter((s) => s.episode.flareUpUserReported).length;
  const split = lens.painSplit ? painSplit(signals) : null;

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
      <Pressable
        onPress={() => nav.push('cycleProfile')}
        accessibilityRole="button"
        accessibilityLabel={`What you told us: ${lens.tags.join(', ') || 'nothing yet'}. Edit`}
        style={cy.told}
      >
        <Text style={[font('footnote'), { color: C.secondary }]}>What you told us</Text>
        <View style={cy.tagRow}>
          {lens.tags.length ? lens.tags.map((t) => <Tag key={t} label={t} tone="neutral" />) : <Tag label="Not set" tone="neutral" />}
        </View>
      </Pressable>

      {!profile.setupDone ? (
        <Panel style={cy.below}>
          <Text style={[font('headline'), { color: C.text }]}>Tell us about your cycle</Text>
          <Text style={[font('subhead'), { color: C.secondary, marginTop: 4 }]}>
            Conditions and life stages change what is useful to track and what can be predicted.
          </Text>
          <View style={{ marginTop: 12 }}>
            <SecondaryButton label="Set Up Your Cycle" onPress={() => nav.push('cycleProfile')} />
          </View>
        </Panel>
      ) : null}

      <View style={cy.tiles}>
        <View style={cy.tile}>
          <Text style={[font('footnote'), { color: C.secondary }]}>{displayCopy(lens.header.label)}</Text>
          <Text style={[font('title2', 'semibold'), { color: C.text }]}>{displayCopy(lens.header.value)}</Text>
        </View>
        {lens.secondary ? (
          <View style={cy.tile}>
            <Text style={[font('footnote'), { color: C.secondary }]}>{displayCopy(lens.secondary.label)}</Text>
            <Text style={[font('title2', 'semibold'), { color: C.text }]}>{displayCopy(lens.secondary.value)}</Text>
          </View>
        ) : null}
      </View>

      {lens.chart !== 'none' ? (
        <Panel style={cy.below}>
          {lens.chart === 'lengthDots' ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Cycle lengths</Text>
              <LengthDots lengths={lens.lengths} />
            </>
          ) : null}
          {lens.chart === 'postpartumTimeline' && lens.weeksSinceBirth != null ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Since birth</Text>
              <PostpartumTimeline weeks={lens.weeksSinceBirth} periodWeeks={lens.periodWeeks} />
            </>
          ) : null}
          {lens.chart === 'monthsSince' && lens.monthsSince != null ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Months since your last period</Text>
              <MonthsSince months={lens.monthsSince} />
            </>
          ) : null}
        </Panel>
      ) : null}

      {lens.notes.map((n) => (
        <Text key={n} style={[font('footnote'), cy.note]}>
          {displayCopy(n)}
        </Text>
      ))}

      {split ? (
        <Panel style={cy.below}>
          <Text style={[font('footnote'), { color: C.secondary }]}>Pain days, last 90 days</Text>
          <View style={[cy.tiles, { marginBottom: 0, marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[font('title3', 'semibold'), { color: C.text }]}>{split.during}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>During your period</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[font('title3', 'semibold'), { color: C.text }]}>{split.outside}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>Outside your period</Text>
            </View>
          </View>
        </Panel>
      ) : null}

      {fertility.show ? (
        <Panel style={cy.below}>
          <Text style={[font('headline'), { color: C.text }]}>Fertile window</Text>
          {fertility.fertile && fertility.ovulation && current ? (
            <>
              <View style={{ marginVertical: 8 }}>
                <FertilityStrip
                  start={current.window.start}
                  fertile={fertility.fertile}
                  ovulation={fertility.ovulation}
                  confirmed={fertility.confirmedThisCycle}
                />
              </View>
              <Text style={[font('subhead'), { color: C.text }]}>
                {displayCopy(
                  fertility.confirmedThisCycle
                    ? `Ovulation confirmed around ${fmtRange(fertility.ovulation.start, fertility.ovulation.end)}.`
                    : `Fertile window likely ${fmtRange(fertility.fertile.start, fertility.fertile.end)}. Ovulation most likely ${fmtRange(fertility.ovulation.start, fertility.ovulation.end)}.`,
                )}
              </Text>
              <Text style={[font('footnote'), cy.fertileLine]}>{displayCopy(`${fertility.confidence} confidence: ${fertility.why}.`)}</Text>
            </>
          ) : null}
          {fertility.notes.map((n) => (
            <Text key={n} style={[font('footnote'), cy.fertileLine]}>
              {displayCopy(n)}
            </Text>
          ))}
          <Text style={[font('footnote'), cy.fertileLine]}>{displayCopy(FERTILITY_DISCLAIMER)}</Text>
        </Panel>
      ) : fertility.hiddenReason ? (
        <Text style={[font('footnote'), cy.note]}>{displayCopy(fertility.hiddenReason)}</Text>
      ) : null}

      <View style={cy.below} />

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
          <ListRow first icon="wave" tint={C.coral} title="Pain" sub={current ? `${current.painDays} days this cycle` : 'No period logged yet'} onPress={history} />
          <ListRow icon="body" tint={C.coral} title="Most reported" sub={locations.join(' · ') || 'Nothing logged yet'} onPress={history} />
          <ListRow icon="target" tint={C.indigo} title="Common sensations" sub={sensations.join(' · ') || 'Nothing logged yet'} onPress={history} />
          <ListRow icon="triangle" tint={C.violet} title="Symptoms" sub={symptoms.join(' · ') || 'Nothing logged yet'} onPress={history} />
          <ListRow icon="flame" tint={C.coral} title="Flare ups" sub={flares ? `${flares} reported by you` : 'None reported'} onPress={history} />
        </ListGroup>
      </View>

      <View style={cy.section}>
        <SecLabel>Over Time</SecLabel>
        <ListGroup>
          {lens.lengths.length ? <ListRow first title="Cycle length" sub={`${lens.lengths.slice(-4).join(' → ')} days`} /> : null}
          <ListRow first={!lens.lengths.length} title="Pain days" sub={last4.map((c) => c.painDays).join(' → ') || 'None logged'} />
          <ListRow title="Pain locations" sub={overallLocations.join(' · ') || 'None logged'} />
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
  told: { minHeight: 44, gap: 6, marginBottom: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  below: { marginBottom: 16 },
  chartLabel: { color: C.secondary, marginBottom: 6 },
  note: { color: C.secondary, marginBottom: 8 },
  fertileLine: { color: C.secondary, marginTop: 6 },
});
